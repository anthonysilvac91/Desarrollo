import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ensureNoManualFileUrl, validateImageFile } from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildAssetThumbnailPath } from '../common/files/storage-paths';
import { randomUUID } from 'crypto';
import { StoredFileKind } from '@prisma/client';
import {
  hasLegacyOwnerAliases,
  isExternalRole,
  LEGACY_OWNER_ALIAS_MESSAGE,
  withOwner,
} from '../common/compat/owner-role-compat';
import { ASSET_IMAGE_MAX_BYTES } from './asset-upload-limits';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
    @Optional() private realtimeService?: RealtimeService,
  ) {}

  private mapAssetRelations<T extends Record<string, any>>(asset: T): T & { owner_id: string | null; owner: any } {
    return withOwner(asset);
  }

  private withLastService<T extends Record<string, any>>(asset: T): T & { last_service: { date: any } | null } {
    const services = Array.isArray(asset.services) ? asset.services : [];

    return {
      ...asset,
      last_service: services[0]?.created_at ? { date: services[0].created_at } : null,
    };
  }

  private async resolveAssetFileUrls<T extends Record<string, any>>(asset: T, organizationId: string) {
    const resolvedAsset = { ...asset } as any;

    resolvedAsset.thumbnail_url = await this.storedFilesService.resolveFileUrlForOrg(
      resolvedAsset.thumbnail_file_id,
      organizationId,
    );

    if (Array.isArray(resolvedAsset.services)) {
      resolvedAsset.services = await Promise.all(
        resolvedAsset.services.map(async (service: any) => ({
          ...service,
          attachments: Array.isArray(service.attachments)
            ? await Promise.all(
                service.attachments.map(async (attachment: any) => ({
                  ...attachment,
                  file_url: await this.storedFilesService.resolveFileUrlForOrg(attachment.file_id, organizationId),
                }))
              )
            : service.attachments,
        }))
      );
    }

    return resolvedAsset;
  }

  private async ensureOwnerBelongsToOrg(ownerId: string, orgId: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id: ownerId, organization_id: orgId, is_active: true },
      select: { id: true },
    });

    if (!owner) {
      throw new BadRequestException('El propietario indicado no pertenece a tu organización');
    }
  }

  async create(createAssetDto: CreateAssetDto, orgId: string, photo?: Express.Multer.File) {
    const {
      owner_id: _ownerId,
      organization_id: dtoOrgId,
      thumbnail_url: _thumbnailUrl,
      ...assetData
    } = createAssetDto;
    if (hasLegacyOwnerAliases(createAssetDto)) {
      throw new BadRequestException(LEGACY_OWNER_ALIAS_MESSAGE);
    }
    const ownerId = createAssetDto.owner_id ?? null;
    if (orgId && dtoOrgId && dtoOrgId !== orgId) {
      throw new BadRequestException('No puedes crear un activo en otra organización');
    }
    const targetOrgId = orgId || dtoOrgId;
    const assetId = randomUUID();
    let thumbnail_url: string | undefined;

    ensureNoManualFileUrl(createAssetDto.thumbnail_url, 'Thumbnail del activo');

    if (!targetOrgId) {
      throw new BadRequestException('Es necesario especificar una organización para el activo');
    }

    if (!ownerId) {
      throw new BadRequestException('Un activo debe asociarse a un owner');
    }

    if (photo) {
      const imageInfo = validateImageFile(photo, {
        maxBytes: ASSET_IMAGE_MAX_BYTES,
        label: 'Thumbnail del activo',
        maxWidth: 6000,
        maxHeight: 6000,
        maxPixels: 24 * 1024 * 1024,
      });
      photo.mimetype = imageInfo.mime;
      await processUploadedImage(photo, {
        maxWidth: 1600,
        maxHeight: 1600,
        format: 'webp',
        quality: 84,
      });
      await this.storageGovernance.assertCanStore(targetOrgId, photo.size);
      thumbnail_url = await this.storageService.uploadFile(photo, {
        folder: buildAssetThumbnailPath(targetOrgId, assetId),
        visibility: 'private',
      });
    }

    let thumbnailFileId: string | null = null;
    if (photo && thumbnail_url) {
      const storedFile = await this.storedFilesService.registerUploadedFile({
        organizationId: targetOrgId,
        storageRef: thumbnail_url,
        originalName: photo.originalname,
        mimeType: photo.mimetype,
        sizeBytes: photo.size,
        kind: StoredFileKind.ASSET_THUMBNAIL,
        visibility: 'private',
        entityType: 'ASSET',
        entityId: assetId,
      });
      thumbnailFileId = storedFile.id;
    }

    await this.ensureOwnerBelongsToOrg(ownerId, targetOrgId);

    let newAsset;
    try {
      newAsset = await this.prisma.asset.create({
        data: {
          id: assetId,
          ...assetData,
          thumbnail_file_id: thumbnailFileId,
          organization_id: targetOrgId,
          owner_id: ownerId,
        },
      });
    } catch (error) {
      if (thumbnailFileId) {
        await this.storedFilesService.deleteStoredFileAndBlob(thumbnailFileId);
      }
      throw error;
    }

    const asset = await this.prisma.asset.findUnique({
      where: { id: newAsset.id },
      include: {
        organization: { select: { name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    if (!asset) {
      return asset;
    }

    const resolvedAsset = await this.resolveAssetFileUrls(this.mapAssetRelations(asset), asset.organization_id);
    this.realtimeService?.emit({
      module: 'assets',
      action: 'created',
      entityId: asset.id,
      organizationId: asset.organization_id,
    });

    return resolvedAsset;
  }

  async findAll(query: any, orgId: string, role: string, ownerId?: string) {
    const include = {
      organization: { select: { name: true } },
      owner: { select: { id: true, name: true } },
      _count: { select: { services: true } },
      services: {
        select: { created_at: true },
        orderBy: { created_at: 'desc' as const },
        take: 1,
      },
    };

    const baseWhere: any = {};

    if (role !== 'SUPER_ADMIN') {
      baseWhere.organization_id = orgId;
    }

    // Workers and external users can only see active assets
    if (role === 'WORKER' || isExternalRole(role)) {
      baseWhere.is_active = true;
    }

    if (isExternalRole(role)) {
      if (!ownerId) {
        return [];
      }
      baseWhere.owner_id = ownerId;
    }

    if (query.search) {
      baseWhere.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { owner: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if ((role === 'ADMIN' || role === 'SUPER_ADMIN') && query.owner_id) {
      baseWhere.owner_id = query.owner_id;
    }

    if ((role === 'ADMIN' || role === 'SUPER_ADMIN') && query.is_active !== undefined && query.is_active !== '') {
      baseWhere.is_active = query.is_active === 'true' || query.is_active === true;
    }

    const orderBy = [{ is_active: 'desc' as const }, { updated_at: 'desc' as const }];

    if (query.page && query.limit) {
      const page = Number(query.page);
      const limit = Number(query.limit);
      const [data, total] = await Promise.all([
        this.prisma.asset.findMany({
          where: baseWhere,
          include,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.asset.count({ where: baseWhere }),
      ]);

      const mappedData = await Promise.all(
        data.map(async (asset: any) =>
          this.resolveAssetFileUrls(
            this.mapAssetRelations(this.withLastService(asset)),
            asset.organization_id,
          )
        )
      );

      return {
        data: mappedData,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const assets = await this.prisma.asset.findMany({ where: baseWhere, include, orderBy });
    return Promise.all(
      assets.map(async (asset: any) =>
        this.resolveAssetFileUrls(
          this.mapAssetRelations(this.withLastService(asset)),
          asset.organization_id,
        )
      )
    );
  }

  async getStats(orgId: string, role: string, ownerId?: string) {
    const baseWhere: any = {};

    if (role !== 'SUPER_ADMIN') {
      baseWhere.organization_id = orgId;
    }
    if (role === 'WORKER') {
      baseWhere.is_active = true;
    }
    if (isExternalRole(role)) {
      if (!ownerId) {
        return { total_assets: 0, active_assets: 0, inactive_assets: 0, assets_with_services: 0 };
      }
      baseWhere.owner_id = ownerId;
      baseWhere.is_active = true;
    }

    const [total, active, withServices] = await Promise.all([
      this.prisma.asset.count({ where: baseWhere }),
      this.prisma.asset.count({ where: { ...baseWhere, is_active: true } }),
      this.prisma.asset.count({ where: { ...baseWhere, services: { some: {} } } }),
    ]);

    return {
      total_assets: total,
      active_assets: active,
      inactive_assets: total - active,
      assets_with_services: withServices,
    };
  }

  async getFilterOptions(orgId: string, role: string, ownerId?: string) {
    const assetWhere: any = {};

    if (role !== 'SUPER_ADMIN') {
      assetWhere.organization_id = orgId;
    }

    if (role === 'WORKER' || isExternalRole(role)) {
      assetWhere.is_active = true;
    }

    if (isExternalRole(role)) {
      if (!ownerId) {
        return { owners: [] };
      }
      assetWhere.owner_id = ownerId;
    }

    const owners = await this.prisma.owner.findMany({
      where: {
        assets: { some: assetWhere },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return { owners };
  }

  async findOne(id: string, user: any) {
    const where: any = { id };
    if (user.role !== 'SUPER_ADMIN') {
      where.organization_id = user.orgId;
    }

    const asset = await this.prisma.asset.findFirst({
      where,
      include: {
        services: {
          include: {
            worker: { select: { name: true, id: true } },
            attachments: { select: { id: true, file_id: true, file_type: true } },
          },
          orderBy: { created_at: 'desc' },
        },
        owner: { select: { id: true, name: true } },
      },
    });

    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }

    if (isExternalRole(user.role)) {
      const currentOwnerId = user.owner_id;
      if (asset.owner_id !== currentOwnerId) {
        throw new NotFoundException('No tienes acceso a este activo');
      }
      asset.services = asset.services.filter((service) => service.is_public);
    }

    return this.resolveAssetFileUrls(this.mapAssetRelations(this.withLastService(asset)), asset.organization_id);
  }

  async assignOwner(assetId: string, ownerId: string, orgId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organization_id: orgId } });
    const owner = await this.prisma.owner.findFirst({ where: { id: ownerId, organization_id: orgId } });

    if (!asset || !owner) {
      throw new NotFoundException('Activo o propietario no existe en su organización');
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id: assetId },
      data: { owner_id: ownerId },
    });

    return this.mapAssetRelations(updatedAsset);
  }

  async removeOwner(assetId: string, ownerId: string, orgId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organization_id: orgId } });
    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }

    throw new BadRequestException('Un activo debe mantener un owner asociado');
  }

  async toggleStatus(id: string, is_active: boolean, user: any) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }
    if (user.role !== 'SUPER_ADMIN' && asset.organization_id !== user.orgId) {
      throw new ForbiddenException('No tienes permiso');
    }
    return this.prisma.asset.update({ where: { id }, data: { is_active } });
  }

  async remove(id: string, user: any) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }

    if (user.role !== 'SUPER_ADMIN' && asset.organization_id !== user.orgId) {
      throw new ForbiddenException('No tienes permiso para borrar este activo');
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id },
      data: { is_active: false },
    });

    if ((asset as any).thumbnail_file_id) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        (asset as any).thumbnail_file_id ?? null,
      );
    }

    return updatedAsset;
  }

  async update(id: string, updateDto: UpdateAssetDto, orgId: string, role: string, photo?: Express.Multer.File) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException('Activo no encontrado');
    }

    if (role !== 'SUPER_ADMIN' && asset.organization_id !== orgId) {
      throw new ForbiddenException('No tienes permiso para editar este activo');
    }

    if (role === 'WORKER') {
      if (!photo) {
        throw new ForbiddenException('Solo puedes actualizar la foto del activo');
      }
      updateDto = {};
    }

    const {
      owner_id: _ownerId,
      thumbnail_url: _thumbnailUrl,
      ...updateData
    } = updateDto;
    if (hasLegacyOwnerAliases(updateDto)) {
      throw new BadRequestException(LEGACY_OWNER_ALIAS_MESSAGE);
    }
    const ownerId = updateDto.owner_id ?? null;
    let thumbnail_url: string | undefined;
    let thumbnailFileId = (asset as any).thumbnail_file_id ?? null;

    ensureNoManualFileUrl(updateDto.thumbnail_url, 'Thumbnail del activo');

    if (photo) {
      const imageInfo = validateImageFile(photo, {
        maxBytes: ASSET_IMAGE_MAX_BYTES,
        label: 'Thumbnail del activo',
        maxWidth: 6000,
        maxHeight: 6000,
        maxPixels: 24 * 1024 * 1024,
      });
      photo.mimetype = imageInfo.mime;
      await processUploadedImage(photo, {
        maxWidth: 1600,
        maxHeight: 1600,
        format: 'webp',
        quality: 84,
      });
      await this.storageGovernance.assertCanStore(
        asset.organization_id,
        photo.size,
        (asset as any).thumbnail_file_id ? [(asset as any).thumbnail_file_id] : [],
      );
      thumbnail_url = await this.storageService.uploadFile(photo, {
        folder: buildAssetThumbnailPath(asset.organization_id, asset.id),
        visibility: 'private',
      });
      const storedFile = await this.storedFilesService.registerUploadedFile({
        organizationId: asset.organization_id,
        storageRef: thumbnail_url,
        originalName: photo.originalname,
        mimeType: photo.mimetype,
        sizeBytes: photo.size,
        kind: StoredFileKind.ASSET_THUMBNAIL,
        visibility: 'private',
        entityType: 'ASSET',
        entityId: asset.id,
      });
      thumbnailFileId = storedFile.id;
    }

    const updatePayload: any = {
      ...updateData,
      thumbnail_file_id: thumbnailFileId,
    };

    if (_ownerId !== undefined) {
      if (!ownerId) {
        throw new BadRequestException('Un activo debe asociarse a un owner');
      }

      await this.ensureOwnerBelongsToOrg(ownerId, asset.organization_id);
      updatePayload.owner_id = ownerId;
    }

    let updatedAsset;
    try {
      updatedAsset = await this.prisma.asset.update({
        where: { id },
        data: updatePayload,
      });
    } catch (error) {
      if (photo && thumbnailFileId && thumbnailFileId !== (asset as any).thumbnail_file_id) {
        await this.storedFilesService.deleteStoredFileAndBlob(thumbnailFileId);
      }
      throw error;
    }

    if (photo && (asset as any).thumbnail_file_id) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        (asset as any).thumbnail_file_id ?? null,
      );
    }

    return this.resolveAssetFileUrls(this.mapAssetRelations(updatedAsset), asset.organization_id);
  }
}
