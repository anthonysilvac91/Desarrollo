import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { validateImageFile } from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildServiceAttachmentsPath } from '../common/files/storage-paths';
import { randomUUID } from 'crypto';
import { StoredFileKind } from '@prisma/client';

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
        ...service.asset,
        company_id: service.asset.company_id ?? service.asset.customer_id ?? null,
        company: service.asset.company ?? service.asset.customer ?? null,
        customer_id: service.asset.company_id ?? service.asset.customer_id ?? null,
        customer: service.asset.company ?? service.asset.customer ?? null,
      }
    };
  }

  private async resolveServiceFileUrls<T extends Record<string, any>>(service: T): Promise<T> {
    const resolvedService = { ...service } as any;

    if (resolvedService.asset) {
      resolvedService.asset.thumbnail_url = resolvedService.asset.thumbnail_file_id
        ? await this.storedFilesService.resolveFileUrl(resolvedService.asset.thumbnail_file_id)
        : null;
    }

    if (Array.isArray(resolvedService.attachments)) {
      resolvedService.attachments = await Promise.all(
        resolvedService.attachments.map(async (attachment: any) => ({
          ...attachment,
          file_url: attachment.file_id
            ? await this.storedFilesService.resolveFileUrl(attachment.file_id)
            : null,
        }))
      );
    }

    return resolvedService;
  }

  async create(createServiceDto: CreateServiceDto, user: any, files?: Express.Multer.File[]) {
    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { auto_publish_services: true, worker_restricted_access: true }
    });
    if (!org) throw new NotFoundException('Organization not found');

    const asset = await this.prisma.asset.findFirst({
      where: {
        id: createServiceDto.asset_id,
        organization_id: user.orgId,
        is_active: true,
      },
      select: { id: true },
    });

    if (!asset) {
      throw new BadRequestException('El activo indicado no pertenece a tu organización');
    }

    if (user.role === 'WORKER' && org.worker_restricted_access) {
      const hasAccess = await this.prisma.workerAssetAccess.findUnique({
        where: {
          worker_id_asset_id: {
            worker_id: user.id,
            asset_id: createServiceDto.asset_id,
          },
        },
        select: { worker_id: true },
      });

      if (!hasAccess) {
        throw new ForbiddenException('No tienes acceso a este activo');
      }
    }

    if (files && files.length > 10) {
      throw new BadRequestException('Solo puedes adjuntar hasta 10 imagenes por servicio');
    }

    const totalIncomingBytes = files?.reduce((total, file) => total + file.size, 0) ?? 0;
    await this.storageGovernance.assertCanStore(user.orgId, totalIncomingBytes);

    const serviceId = randomUUID();
    const attachmentPromises = files?.map(async (file) => {
      const imageInfo = validateImageFile(file, {
        maxBytes: 10 * 1024 * 1024,
        label: 'Adjunto de servicio',
        maxWidth: 6000,
        maxHeight: 6000,
        maxPixels: 24 * 1024 * 1024,
      });
      file.mimetype = imageInfo.mime;
      await processUploadedImage(file, {
        maxWidth: 2400,
        maxHeight: 2400,
        format: 'webp',
        quality: 82,
      });

      const file_url = await this.storageService.uploadFile(file, {
        folder: buildServiceAttachmentsPath(user.orgId, serviceId),
        visibility: 'private',
      });
      const storedFile = await this.storedFilesService.registerFile({
        organizationId: user.orgId,
        storageRef: file_url,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        kind: StoredFileKind.SERVICE_ATTACHMENT,
        visibility: 'private',
        ownerType: 'SERVICE',
        ownerId: serviceId,
        uploadedByUserId: user.id,
      });
      return {
        file_id: storedFile.id,
        file_type: file.mimetype,
        file_name: file.originalname,
        file_size_bytes: file.size,
      };
    }) || [];

    const attachments = await Promise.all(attachmentPromises);

    const newService = await this.prisma.service.create({
      data: {
        id: serviceId,
        ...createServiceDto,
        organization_id: user.orgId,
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
    return this.resolveServiceFileUrls(newService);
  }

  async findAll(query: ListServicesQueryDto, user: any) {
    const whereClause: any = {};
    
    if (user.role !== 'SUPER_ADMIN') {
      whereClause.organization_id = user.orgId;
    }
    
    if (query.asset_id) whereClause.asset_id = query.asset_id;

    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      const end = new Date(query.endDate);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      whereClause.created_at = { gte: start, lte: end };
    }

    if (user.role === 'CLIENT') {
      const currentCompanyId = user.company_id ?? user.customer_id;
      if (!currentCompanyId) {
        return query.page && query.limit
          ? {
              data: [],
              meta: { total: 0, page: Number(query.page), limit: Number(query.limit), totalPages: 0 },
            }
          : [];
      }

      whereClause.is_public = true;
      whereClause.status = 'COMPLETED';
      whereClause.asset = { company_id: currentCompanyId };
    }

    if (user.role === 'WORKER') {
      const workerAssetWhere = await this.buildRestrictedWorkerAssetWhere(user.orgId, user.id);
      if (workerAssetWhere) {
        whereClause.asset = { ...(whereClause.asset ?? {}), ...workerAssetWhere };
      }
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
            asset: { select: { id: true, name: true, location: true, company_id: true, thumbnail_url: true, thumbnail_file_id: true, company: { select: { id: true, name: true } } } },
            attachments: { select: { file_id: true, file_url: true, file_type: true } },
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.service.count({ where: whereClause })
      ]);
      const mappedData = await Promise.all(
        data.map(async (item: any) => this.resolveServiceFileUrls(this.mapServiceRelations(item)))
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
        asset: { select: { id: true, name: true, location: true, company_id: true, thumbnail_url: true, thumbnail_file_id: true, company: { select: { id: true, name: true } } } },
        attachments: { select: { file_id: true, file_url: true, file_type: true } },
      },
      orderBy: { created_at: 'desc' }
    });
    return Promise.all(
      services.map(async (item: any) => this.resolveServiceFileUrls(this.mapServiceRelations(item)))
    );
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
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        attachments: true,
        worker: { select: { name: true, id: true } },
        asset: { select: { name: true, id: true, category: true, company_id: true, location: true, thumbnail_url: true, thumbnail_file_id: true, company: { select: { id: true, name: true } } } }
      }
    });

    if (!service) {
      throw new NotFoundException('Service no encontrado');
    }

    if (user.role !== 'SUPER_ADMIN' && service.organization_id !== user.orgId) {
      throw new NotFoundException('Service no encontrado o acceso denegado');
    }

    if (user.role === 'CLIENT') {
      if (!service.is_public) {
        throw new ForbiddenException('No tienes permiso para ver este servicio privado');
      }

      const currentCompanyId = user.company_id ?? user.customer_id;
      if (!currentCompanyId || service.asset.company_id !== currentCompanyId) {
        throw new NotFoundException('Service no encontrado o acceso denegado');
      }
    }

    if (user.role === 'WORKER') {
      await this.assertWorkerCanAccessAsset(user.orgId, user.id, service.asset.id);
    }

    return this.resolveServiceFileUrls(this.mapServiceRelations(service));
  }

  async remove(id: string, user: any) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    
    if (!service) {
      throw new NotFoundException('Service no encontrado');
    }

    // Seguridad: Si no es Super Admin, debe pertenecer a su organización
    if (user.role !== 'SUPER_ADMIN' && service.organization_id !== user.orgId) {
      throw new ForbiddenException('Acceso denegado para eliminar este servicio');
    }

    const attachments = await this.prisma.serviceAttachment.findMany({
      where: { service_id: id },
      select: { file_id: true, file_url: true },
    });

    // Eliminar primero los archivos adjuntos relacionados (Foreign Key)
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

    // Eliminar el servicio
    return this.prisma.service.delete({
      where: { id }
    });
  }

  private async buildRestrictedWorkerAssetWhere(orgId: string | undefined, userId: string) {
    if (!orgId) return undefined;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { worker_restricted_access: true },
    });

    if (!org?.worker_restricted_access) {
      return undefined;
    }

    return { worker_access: { some: { worker_id: userId } } };
  }

  private async assertWorkerCanAccessAsset(orgId: string | undefined, userId: string, assetId: string) {
    if (!orgId) {
      throw new NotFoundException('Service no encontrado o acceso denegado');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { worker_restricted_access: true },
    });

    if (!org?.worker_restricted_access) {
      return;
    }

    const hasAccess = await this.prisma.workerAssetAccess.findUnique({
      where: {
        worker_id_asset_id: {
          worker_id: userId,
          asset_id: assetId,
        },
      },
      select: { worker_id: true },
    });

    if (!hasAccess) {
      throw new NotFoundException('Service no encontrado o acceso denegado');
    }
  }
}
