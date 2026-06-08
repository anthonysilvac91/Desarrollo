import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { ServiceStatsQueryDto } from './dto/service-stats-query.dto';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { validateImageFile } from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildServiceAttachmentsPath } from '../common/files/storage-paths';
import { randomUUID } from 'crypto';
import { StoredFileKind } from '@prisma/client';
import { isExternalRole, withOwner } from '../common/compat/owner-role-compat';

const SERVICE_ATTACHMENT_MAX_FILES = 10;
const SERVICE_ATTACHMENT_MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
const SERVICE_ATTACHMENT_MAX_TOTAL_ORIGINAL_BYTES = 40 * 1024 * 1024;
const SERVICE_ATTACHMENT_MAX_DIMENSION = 6000;
const SERVICE_ATTACHMENT_MAX_PIXELS = 24 * 1024 * 1024;
const SERVICE_ATTACHMENT_OUTPUT_MAX_DIMENSION = 2000;
const SERVICE_ATTACHMENT_OUTPUT_QUALITY = 82;
const SERVICE_ATTACHMENT_OUTPUT_FORMAT = 'webp';

function resolveDateRange(preset?: string, startDate?: string, endDate?: string): { gte: Date; lte: Date } | undefined {
  const now = new Date();
  if (preset === 'Hoy') {
    return {
      gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)),
      lte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)),
    };
  }
  if (preset === 'Mes') {
    return {
      gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)),
      lte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
    };
  }
  if (preset === 'Año') {
    return {
      gte: new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0)),
      lte: new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999)),
    };
  }
  if (preset === 'Personalizado' && startDate && endDate) {
    return {
      gte: new Date(startDate + 'T00:00:00.000Z'),
      lte: new Date(endDate + 'T23:59:59.999Z'),
    };
  }
  return undefined;
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
  ) {}

  private mapServiceRelations<T extends Record<string, any>>(service: T): T {
    if (!service.asset) {
      return service;
    }

    return {
      ...service,
      asset: {
        ...withOwner(service.asset),
      }
    };
  }

  private async resolveServiceFileUrls<T extends Record<string, any>>(service: T, organizationId: string): Promise<T> {
    const resolvedService = { ...service } as any;

    if (resolvedService.asset) {
      resolvedService.asset.thumbnail_url = await this.storedFilesService.resolveFileUrlForOrg(
        resolvedService.asset.thumbnail_file_id,
        organizationId,
      );
    }

    if (Array.isArray(resolvedService.attachments)) {
      resolvedService.attachments = await Promise.all(
        resolvedService.attachments.map(async (attachment: any) => ({
          ...attachment,
          file_url: await this.storedFilesService.resolveFileUrlForOrg(attachment.file_id, organizationId),
        }))
      );
    }

    return resolvedService;
  }

  async create(createServiceDto: CreateServiceDto, user: any, files?: Express.Multer.File[]) {
    let serviceOrgId: string;

    if (user.role === 'SUPER_ADMIN') {
      const asset = await this.prisma.asset.findFirst({
        where: { id: createServiceDto.asset_id, is_active: true },
        select: { id: true, organization_id: true },
      });
      if (!asset) throw new BadRequestException('El activo indicado no existe');
      serviceOrgId = asset.organization_id;
    } else {
      const asset = await this.prisma.asset.findFirst({
        where: { id: createServiceDto.asset_id, organization_id: user.orgId, is_active: true },
        select: { id: true },
      });
      if (!asset) throw new BadRequestException('El activo indicado no pertenece a tu organización');
      serviceOrgId = user.orgId;
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: serviceOrgId },
      select: { auto_publish_services: true }
    });
    if (!org) throw new NotFoundException('Organization not found');

    if (files && files.length > SERVICE_ATTACHMENT_MAX_FILES) {
      throw new BadRequestException('Solo puedes adjuntar hasta 10 imagenes por servicio');
    }

    const totalOriginalBytes = files?.reduce((total, file) => total + file.size, 0) ?? 0;
    if (totalOriginalBytes > SERVICE_ATTACHMENT_MAX_TOTAL_ORIGINAL_BYTES) {
      throw new BadRequestException('Los adjuntos del servicio exceden el maximo total permitido');
    }

    const serviceId = randomUUID();
    const attachments: Array<{
      file_id: string;
      file_type: string;
      file_name: string;
      file_size_bytes: number;
    }> = [];
    const storedFileIds: string[] = [];
    const uploadedStorageRefs: string[] = [];

    try {
      for (const file of files ?? []) {
        const imageInfo = validateImageFile(file, {
          maxBytes: SERVICE_ATTACHMENT_MAX_ORIGINAL_BYTES,
          label: 'Adjunto de servicio',
          maxWidth: SERVICE_ATTACHMENT_MAX_DIMENSION,
          maxHeight: SERVICE_ATTACHMENT_MAX_DIMENSION,
          maxPixels: SERVICE_ATTACHMENT_MAX_PIXELS,
        });
        file.mimetype = imageInfo.mime;
        await processUploadedImage(file, {
          maxWidth: SERVICE_ATTACHMENT_OUTPUT_MAX_DIMENSION,
          maxHeight: SERVICE_ATTACHMENT_OUTPUT_MAX_DIMENSION,
          format: SERVICE_ATTACHMENT_OUTPUT_FORMAT,
          quality: SERVICE_ATTACHMENT_OUTPUT_QUALITY,
        });
      }

      const totalProcessedBytes = files?.reduce((total, file) => total + file.size, 0) ?? 0;
      await this.storageGovernance.assertCanStore(serviceOrgId, totalProcessedBytes);

      for (const file of files ?? []) {
        const file_url = await this.storageService.uploadFile(file, {
          folder: buildServiceAttachmentsPath(serviceOrgId, serviceId),
          visibility: 'private',
        });
        uploadedStorageRefs.push(file_url);
        const storedFile = await this.storedFilesService.registerUploadedFile({
          organizationId: serviceOrgId,
          storageRef: file_url,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          kind: StoredFileKind.SERVICE_ATTACHMENT,
          visibility: 'private',
          entityType: 'SERVICE',
          entityId: serviceId,
          uploadedByUserId: user.id,
        });
        storedFileIds.push(storedFile.id);
        const uploadedRefIndex = uploadedStorageRefs.indexOf(file_url);
        if (uploadedRefIndex !== -1) {
          uploadedStorageRefs.splice(uploadedRefIndex, 1);
        }
        attachments.push({
          file_id: storedFile.id,
          file_type: file.mimetype,
          file_name: file.originalname,
          file_size_bytes: file.size,
        });
      }

      const newService = await this.prisma.service.create({
        data: {
          id: serviceId,
          ...createServiceDto,
          organization_id: serviceOrgId,
          worker_id: user.id,
          is_public: org.auto_publish_services,
          status: 'COMPLETED',
          attachments: {
            create: attachments,
          }
        },
        include: { attachments: true }
      });

      this.logger.log(`Service created: Asset [${createServiceDto.asset_id}] by Worker [${user.id}] with ${attachments.length} attachments`);
      return this.resolveServiceFileUrls(newService, serviceOrgId);
    } catch (error) {
      await Promise.all([
        ...storedFileIds.map((id) => this.storedFilesService.deleteStoredFileAndBlob(id)),
        ...uploadedStorageRefs.map((ref) => this.storageService.deleteFile(ref)),
      ]);
      throw error;
    }
  }

  async findAll(query: ListServicesQueryDto, user: any) {
    const whereClause: any = {};
    
    if (user.role !== 'SUPER_ADMIN') {
      whereClause.organization_id = user.orgId;
    }
    
    if (query.asset_id) whereClause.asset_id = query.asset_id;
    if (query.worker_id) whereClause.worker_id = query.worker_id;

    const dateRange = resolveDateRange(query.preset, query.startDate, query.endDate);
    if (dateRange) whereClause.created_at = dateRange;

    if (isExternalRole(user.role)) {
      const currentOwnerId = user.owner_id ?? null;
      if (!currentOwnerId) {
        return query.page && query.limit
          ? {
              data: [],
              meta: { total: 0, page: Number(query.page), limit: Number(query.limit), totalPages: 0 },
            }
          : [];
      }

      whereClause.is_public = true;
      whereClause.status = 'COMPLETED';
      whereClause.asset = { owner_id: currentOwnerId };
    }

    if (query.search) {
      whereClause.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { worker: { name: { contains: query.search, mode: 'insensitive' } } },
        { asset: { name: { contains: query.search, mode: 'insensitive' } } }
      ];
    }

    if (query.page && query.limit) {
      const page = Number(query.page);
      const limit = Number(query.limit);
      const [data, total] = await Promise.all([
        this.prisma.service.findMany({
          where: whereClause,
          include: {
            worker: { select: { id: true, name: true } },
            asset: { select: { id: true, name: true, location: true, owner_id: true, thumbnail_file_id: true, owner: { select: { id: true, name: true } } } },
            attachments: { select: { id: true, file_id: true, file_type: true } },
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.service.count({ where: whereClause })
      ]);
      const mappedData = await Promise.all(
        data.map(async (item: any) => this.resolveServiceFileUrls(this.mapServiceRelations(item), item.organization_id))
      );

      return {
        data: mappedData,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    const services = await this.prisma.service.findMany({
      where: whereClause,
      include: {
        worker: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, location: true, owner_id: true, thumbnail_file_id: true, owner: { select: { id: true, name: true } } } },
        attachments: { select: { id: true, file_id: true, file_type: true } },
      },
      orderBy: { created_at: 'desc' }
    });
    return Promise.all(
      services.map(async (item: any) => this.resolveServiceFileUrls(this.mapServiceRelations(item), item.organization_id))
    );
  }

  async getStats(query: ServiceStatsQueryDto, user: any) {
    const baseWhere: any = {};

    if (user.role !== 'SUPER_ADMIN') {
      baseWhere.organization_id = user.orgId;
    }

    if (isExternalRole(user.role)) {
      const currentOwnerId = user.owner_id ?? null;
      if (!currentOwnerId) {
        return { total_services: 0, period_services: 0, assets_serviced: 0, active_operators: 0 };
      }
      baseWhere.is_public = true;
      baseWhere.status = 'COMPLETED';
      baseWhere.asset = { owner_id: currentOwnerId };
    }

    const periodWhere: any = { ...baseWhere };

    const dateRange = resolveDateRange(query.preset, query.startDate, query.endDate);
    if (dateRange) periodWhere.created_at = dateRange;

    const [total_services, period_services, assetGroups, workerGroups] = await Promise.all([
      this.prisma.service.count({ where: baseWhere }),
      this.prisma.service.count({ where: periodWhere }),
      this.prisma.service.groupBy({ by: ['asset_id'], where: periodWhere }),
      this.prisma.service.groupBy({ by: ['worker_id'], where: { ...periodWhere, worker_id: { not: null } } }),
    ]);

    return {
      total_services,
      period_services,
      assets_serviced: assetGroups.length,
      active_operators: workerGroups.length,
    };
  }

  async getFilterOptions(user: any) {
    const serviceWhere: any = {};

    if (user.role !== 'SUPER_ADMIN') {
      serviceWhere.organization_id = user.orgId;
    }

    if (isExternalRole(user.role)) {
      const currentOwnerId = user.owner_id ?? null;
      if (!currentOwnerId) {
        return { workers: [], assets: [] };
      }

      serviceWhere.is_public = true;
      serviceWhere.status = 'COMPLETED';
      serviceWhere.asset = { owner_id: currentOwnerId };
    }

    const [workers, assets] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          services_created: { some: serviceWhere },
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.asset.findMany({
        where: {
          services: { some: serviceWhere },
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { workers, assets };
  }

  async update(id: string, updateServiceDto: UpdateServiceDto, orgId: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service || service.organization_id !== orgId) {
      throw new NotFoundException('Service no encontrado o no pertenece a tu Organización');
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        ...updateServiceDto,
        admin_intervened: true
      }
    });
  }

  async findOne(id: string, user: any) {
    const where: any = { id };
    if (user.role !== 'SUPER_ADMIN') {
      where.organization_id = user.orgId;
    }

    const service = await this.prisma.service.findFirst({
      where,
      include: {
        attachments: true,
        worker: { select: { name: true, id: true } },
        asset: { select: { name: true, id: true, category: true, owner_id: true, location: true, thumbnail_file_id: true, owner: { select: { id: true, name: true } } } }
      }
    });

    if (!service) {
      throw new NotFoundException('Service no encontrado');
    }

    if (isExternalRole(user.role)) {
      if (!service.is_public) {
        throw new ForbiddenException('No tienes permiso para ver este servicio privado');
      }

      const currentOwnerId = user.owner_id ?? null;
      if (!currentOwnerId || service.asset.owner_id !== currentOwnerId) {
        throw new NotFoundException('Service no encontrado o acceso denegado');
      }
    }

    return this.resolveServiceFileUrls(this.mapServiceRelations(service), service.organization_id);
  }

  async remove(id: string, user: any) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    
    if (!service) {
      throw new NotFoundException('Service no encontrado');
    }

    if (user.role !== 'SUPER_ADMIN' && service.organization_id !== user.orgId) {
      throw new ForbiddenException('Acceso denegado para eliminar este servicio');
    }

    const attachments = await this.prisma.serviceAttachment.findMany({
      where: { service_id: id },
      select: { file_id: true },
    });

    await this.prisma.serviceAttachment.deleteMany({
      where: { service_id: id }
    });

    await Promise.all(
      attachments.map((attachment) =>
        this.storedFilesService.deleteStoredFileAndBlob(
          attachment.file_id,
        ),
      ),
    );

    return this.prisma.service.delete({
      where: { id }
    });
  }

}
