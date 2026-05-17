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
import { isExternalRole, withOwner } from '../common/compat/owner-role-compat';

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

  private async resolveServiceFileUrls<T extends Record<string, any>>(service: T): Promise<T> {
    const resolvedService = { ...service } as any;

    if (resolvedService.asset) {
      resolvedService.asset.thumbnail_url = await this.storedFilesService.resolveFileUrl(
        resolvedService.asset.thumbnail_file_id,
      );
    }

    if (Array.isArray(resolvedService.attachments)) {
      resolvedService.attachments = await Promise.all(
        resolvedService.attachments.map(async (attachment: any) => ({
          ...attachment,
          file_url: await this.storedFilesService.resolveFileUrl(attachment.file_id),
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

    if (files && files.length > 10) {
      throw new BadRequestException('Solo puedes adjuntar hasta 10 imagenes por servicio');
    }

    const totalIncomingBytes = files?.reduce((total, file) => total + file.size, 0) ?? 0;
    await this.storageGovernance.assertCanStore(serviceOrgId, totalIncomingBytes);

    const serviceId = randomUUID();
    const attachments: Array<{
      file_id: string;
      file_type: string;
      file_name: string;
      file_size_bytes: number;
    }> = [];
    const storedFileIds: string[] = [];

    try {
      for (const file of files ?? []) {
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
          folder: buildServiceAttachmentsPath(serviceOrgId, serviceId),
          visibility: 'private',
        });
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
      return this.resolveServiceFileUrls(newService);
    } catch (error) {
      await Promise.all(storedFileIds.map((id) => this.storedFilesService.deleteStoredFileAndBlob(id)));
      throw error;
    }
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
        asset: { select: { id: true, name: true, location: true, owner_id: true, thumbnail_file_id: true, owner: { select: { id: true, name: true } } } },
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
        asset: { select: { name: true, id: true, category: true, owner_id: true, location: true, thumbnail_file_id: true, owner: { select: { id: true, name: true } } } }
      }
    });

    if (!service) {
      throw new NotFoundException('Service no encontrado');
    }

    if (user.role !== 'SUPER_ADMIN' && service.organization_id !== user.orgId) {
      throw new NotFoundException('Service no encontrado o acceso denegado');
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

    return this.resolveServiceFileUrls(this.mapServiceRelations(service));
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
