import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOwnerDto } from './dto/create-company.dto';
import { UpdateOwnerDto } from './dto/update-company.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { ensureNoManualFileUrl, validateImageFile } from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildOwnerLogoPath } from '../common/files/storage-paths';
import { randomUUID } from 'crypto';
import { StoredFileKind } from '@prisma/client';
import { withOwner } from '../common/compat/owner-role-compat';

@Injectable()
export class OwnersService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
  ) {}

  private mapOwnerRelations<T extends Record<string, any>>(owner: T): T & { owner_users?: any[]; owner_assets?: any[] } {
    return {
      ...withOwner(owner),
      owner_id: owner.id,
      owner_users: owner.users ?? undefined,
      owner_assets: owner.assets ?? undefined,
    };
  }

  private async resolveOwnerFileUrls<T extends Record<string, any>>(owner: T) {
    const resolvedOwner = { ...owner } as any;

    if (Array.isArray(resolvedOwner.assets)) {
      resolvedOwner.assets = await Promise.all(
        resolvedOwner.assets.map(async (asset: any) => ({
          ...asset,
          thumbnail_url: await this.storedFilesService.resolveFileUrl(asset.thumbnail_file_id),
        }))
      );
    }

    resolvedOwner.logo_url = await this.storedFilesService.resolveFileUrl(resolvedOwner.logo_file_id);

    return resolvedOwner;
  }

  private async attachOwnerUsageCounts<T extends Record<string, any>>(orgId: string, owners: T[]) {
    if (owners.length === 0) return owners;

    const ownerIds = owners.map((owner) => owner.id);
    const servicesByOwner = await this.prisma.service.groupBy({
      by: ['asset_id'],
      where: {
        organization_id: orgId,
        asset: {
          owner_id: { in: ownerIds },
          is_active: true,
        },
      },
      _count: { _all: true },
    });

    const assets = await this.prisma.asset.findMany({
      where: {
        organization_id: orgId,
        owner_id: { in: ownerIds },
        is_active: true,
      },
      select: { id: true, owner_id: true },
    });

    const ownerServiceCounts = new Map<string, number>();
    const assetOwnerMap = new Map(assets.map((asset) => [asset.id, asset.owner_id]));

    for (const serviceGroup of servicesByOwner) {
      const ownerId = assetOwnerMap.get(serviceGroup.asset_id);
      if (!ownerId) continue;
      ownerServiceCounts.set(
        ownerId,
        (ownerServiceCounts.get(ownerId) ?? 0) + serviceGroup._count._all,
      );
    }

    return owners.map((owner) => {
      const { _count, ...ownerData } = owner;
      return {
        ...ownerData,
        assets_count: _count?.assets ?? 0,
        services_count: ownerServiceCounts.get(owner.id) ?? 0,
      };
    });
  }

  async create(createOwnerDto: CreateOwnerDto, orgId: string, logoFile?: Express.Multer.File) {
    ensureNoManualFileUrl(createOwnerDto.logo_url, 'Logo de owner');
    const { logo_url: _logoUrl, ...ownerData } = createOwnerDto;

    const ownerId = randomUUID();
    let logoUrl: string | undefined;
    if (logoFile) {
      const imageInfo = validateImageFile(logoFile, {
        maxBytes: 2 * 1024 * 1024,
        label: 'Logo de owner',
        maxWidth: 4096,
        maxHeight: 4096,
        maxPixels: 12 * 1024 * 1024,
      });
      logoFile.mimetype = imageInfo.mime;
      await processUploadedImage(logoFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        format: 'webp',
        quality: 88,
      });
      await this.storageGovernance.assertCanStore(orgId, logoFile.size);
      logoUrl = await this.storageService.uploadFile(logoFile, {
        folder: buildOwnerLogoPath(orgId, ownerId),
        visibility: 'private',
      });
    }

    let logoFileId: string | null = null;
    if (logoFile && logoUrl) {
      const storedFile = await this.storedFilesService.registerUploadedFile({
        organizationId: orgId,
        storageRef: logoUrl,
        originalName: logoFile.originalname,
        mimeType: logoFile.mimetype,
        sizeBytes: logoFile.size,
        kind: StoredFileKind.OWNER_LOGO,
        visibility: 'private',
        entityType: 'OWNER',
        entityId: ownerId,
      });
      logoFileId = storedFile.id;
    }

    let owner;
    try {
      owner = await this.prisma.owner.create({
        data: {
          id: ownerId,
          ...ownerData,
          logo_file_id: logoFileId,
          organization_id: orgId,
        },
      });
    } catch (error) {
      if (logoFileId) {
        await this.storedFilesService.deleteStoredFileAndBlob(logoFileId);
      }
      throw error;
    }
    return this.resolveOwnerFileUrls(this.mapOwnerRelations(owner));
  }

  async findAll(orgId: string, query?: PaginationQueryDto) {
    const where: any = { organization_id: orgId, is_active: true };
    
    if (query?.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    if (query?.page && query?.limit) {
      const page = Number(query.page);
      const limit = Number(query.limit);
      const [data, total] = await Promise.all([
        this.prisma.owner.findMany({
          where,
          include: {
            _count: {
              select: {
                assets: { where: { is_active: true } },
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.owner.count({ where })
      ]);
      const dataWithCounts = await this.attachOwnerUsageCounts(orgId, data);
      return {
        data: await Promise.all(dataWithCounts.map((item: any) => this.resolveOwnerFileUrls(this.mapOwnerRelations(item)))),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    const owners = await this.prisma.owner.findMany({
      where,
      include: {
        _count: {
          select: {
            assets: { where: { is_active: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' }
    });
    const ownersWithCounts = await this.attachOwnerUsageCounts(orgId, owners);
    return Promise.all(ownersWithCounts.map((item: any) => this.resolveOwnerFileUrls(this.mapOwnerRelations(item))));
  }

  async findOne(id: string, orgId: string) {
    const owner = await this.prisma.owner.findUnique({
      where: { id },
      include: {
        users: { where: { is_active: true }, select: { id: true, name: true, email: true, role: true } },
        assets: { where: { is_active: true }, select: { id: true, name: true, category: true, thumbnail_file_id: true } }
      }
    });
    if (!owner || owner.organization_id !== orgId) {
      throw new NotFoundException('Owner no encontrado');
    }
    return this.resolveOwnerFileUrls(this.mapOwnerRelations(owner));
  }

  async update(id: string, updateOwnerDto: UpdateOwnerDto, orgId: string, logoFile?: Express.Multer.File) {
    const existingOwner = await this.prisma.owner.findUnique({
      where: { id },
      select: { id: true, organization_id: true, logo_file_id: true },
    });

    if (!existingOwner || existingOwner.organization_id !== orgId) {
      throw new NotFoundException('Owner no encontrado');
    }

    ensureNoManualFileUrl(updateOwnerDto.logo_url, 'Logo de owner');
    const { logo_url: _logoUrl, ...ownerData } = updateOwnerDto;

    let logoUrl: string | undefined;
    if (logoFile) {
      const imageInfo = validateImageFile(logoFile, {
        maxBytes: 2 * 1024 * 1024,
        label: 'Logo de owner',
        maxWidth: 4096,
        maxHeight: 4096,
        maxPixels: 12 * 1024 * 1024,
      });
      logoFile.mimetype = imageInfo.mime;
      await processUploadedImage(logoFile, {
        maxWidth: 1200,
        maxHeight: 1200,
        format: 'webp',
        quality: 88,
      });
      await this.storageGovernance.assertCanStore(
        orgId,
        logoFile.size,
        existingOwner.logo_file_id ? [existingOwner.logo_file_id] : [],
      );
      logoUrl = await this.storageService.uploadFile(logoFile, {
        folder: buildOwnerLogoPath(orgId, existingOwner.id),
        visibility: 'private',
      });
    }

    let logoFileId = existingOwner.logo_file_id;
    if (logoFile && logoUrl) {
      const storedFile = await this.storedFilesService.registerUploadedFile({
        organizationId: orgId,
        storageRef: logoUrl,
        originalName: logoFile.originalname,
        mimeType: logoFile.mimetype,
        sizeBytes: logoFile.size,
        kind: StoredFileKind.OWNER_LOGO,
        visibility: 'private',
        entityType: 'OWNER',
        entityId: existingOwner.id,
      });
      logoFileId = storedFile.id;
    }

    let owner;
    try {
      owner = await this.prisma.owner.update({
        where: { id: existingOwner.id },
        data: {
          ...ownerData,
          logo_file_id: logoFileId,
        },
      });
    } catch (error) {
      if (logoFile && logoFileId && logoFileId !== existingOwner.logo_file_id) {
        await this.storedFilesService.deleteStoredFileAndBlob(logoFileId);
      }
      throw error;
    }

    if (logoFile && existingOwner.logo_file_id) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        existingOwner.logo_file_id,
      );
    }

    return this.resolveOwnerFileUrls(this.mapOwnerRelations(owner));
  }

  async deactivate(id: string, orgId: string) {
    const existingOwner = await this.prisma.owner.findUnique({
      where: { id },
      select: { id: true, organization_id: true },
    });

    if (!existingOwner || existingOwner.organization_id !== orgId) {
      throw new NotFoundException('Owner no encontrado');
    }

    const [owner, assetsResult] = await this.prisma.$transaction([
      this.prisma.owner.update({
        where: { id: existingOwner.id },
        data: { is_active: false },
      }),
      this.prisma.asset.updateMany({
        where: {
          organization_id: orgId,
          owner_id: existingOwner.id,
          is_active: true,
        },
        data: { is_active: false },
      }),
    ]);

    return this.resolveOwnerFileUrls({
      ...this.mapOwnerRelations(owner),
      deactivated_assets_count: assetsResult.count,
    });
  }

  async remove(id: string, orgId: string) {
    return this.deactivate(id, orgId);
  }
}
