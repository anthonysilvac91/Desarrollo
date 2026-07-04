import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOwnerDto } from './dto/create-company.dto';
import { UpdateOwnerDto } from './dto/update-company.dto';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerQueryDto } from './dto/owner-query.dto';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import {
  ensureNoManualFileUrl,
  validateImageFile,
} from '../common/files/image-validation';
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

  private mapOwnerRelations<T extends Record<string, any>>(
    owner: T,
  ): T & { owner_users?: any[]; owner_assets?: any[] } {
    return {
      ...withOwner(owner),
      owner_id: owner.id,
      owner_users: owner.users ?? undefined,
      owner_assets: owner.assets ?? undefined,
    };
  }

  private async resolveOwnerFileUrls<T extends Record<string, any>>(
    owner: T,
    organizationId: string,
  ) {
    const ids = this.collectOwnerFileIds(owner);
    const urlMap = await this.storedFilesService.resolveFileUrlsForOrg(
      ids,
      organizationId,
    );
    return this.applyOwnerUrlMap(owner, urlMap);
  }

  private collectOwnerFileIds(owner: any): Array<string | null | undefined> {
    const ids: Array<string | null | undefined> = [owner.logo_file_id];
    if (Array.isArray(owner.assets)) {
      for (const asset of owner.assets) ids.push(asset.thumbnail_file_id);
    }
    return ids;
  }

  private applyOwnerUrlMap<T extends Record<string, any>>(
    owner: T,
    urlMap: Map<string, string | null>,
  ): T {
    const resolvedOwner = { ...owner } as any;
    resolvedOwner.logo_url = urlMap.get(resolvedOwner.logo_file_id) ?? null;
    if (Array.isArray(resolvedOwner.assets)) {
      resolvedOwner.assets = resolvedOwner.assets.map((asset: any) => ({
        ...asset,
        thumbnail_url: urlMap.get(asset.thumbnail_file_id) ?? null,
      }));
    }
    return resolvedOwner;
  }

  private async resolveOwnersFileUrls<T extends Record<string, any>>(
    owners: T[],
    organizationId: string,
  ): Promise<T[]> {
    if (owners.length === 0) return [];
    const allIds = owners.flatMap((o) => this.collectOwnerFileIds(o));
    const urlMap = await this.storedFilesService.resolveFileUrlsForOrg(
      allIds,
      organizationId,
    );
    return owners.map((o) => this.applyOwnerUrlMap(o, urlMap));
  }

  private async attachOwnerUsageCounts<T extends Record<string, any>>(
    orgId: string,
    owners: T[],
  ) {
    if (owners.length === 0) return owners;

    const ownerIds = owners.map((owner) => owner.id);
    const servicesByOwner = await this.prisma.service.groupBy({
      by: ['asset_id'],
      where: {
        organization_id: orgId,
        deleted_at: null,
        purged_at: null,
        asset: {
          owner_id: { in: ownerIds },
          is_active: true,
          deleted_at: null,
          purged_at: null,
        },
      },
      _count: { _all: true },
    });

    const assets = await this.prisma.asset.findMany({
      where: {
        organization_id: orgId,
        owner_id: { in: ownerIds },
        is_active: true,
        deleted_at: null,
        purged_at: null,
      },
      select: { id: true, owner_id: true },
    });

    const ownerServiceCounts = new Map<string, number>();
    const assetOwnerMap = new Map(
      assets.map((asset) => [asset.id, asset.owner_id]),
    );

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

  async create(
    createOwnerDto: CreateOwnerDto,
    orgId: string,
    logoFile?: Express.Multer.File,
  ) {
    ensureNoManualFileUrl(createOwnerDto.logo_url, 'Logo de owner');
    const { logo_url: _logoUrl, ...ownerData } = createOwnerDto;
    const ownerName = ownerData.name?.trim();

    if (!ownerName) {
      throw new BadRequestException('El nombre es requerido');
    }

    const existingOwner = await this.prisma.owner.findFirst({
      where: {
        organization_id: orgId,
        name: { equals: ownerName, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (existingOwner) {
      throw new BadRequestException('Ya existe un owner con ese nombre');
    }

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
          name: ownerName,
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
    return this.resolveOwnerFileUrls(this.mapOwnerRelations(owner), orgId);
  }

  async findAll(orgId: string, query?: OwnerQueryDto) {
    const where: any = {
      organization_id: orgId,
      deleted_at: null,
      purged_at: null,
    };

    if (query?.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    if (query?.is_active === 'true' || query?.is_active === 'false') {
      where.is_active = query.is_active === 'true';
    }

    const orderBy = [
      { is_active: 'desc' as const },
      { created_at: 'desc' as const },
    ];

    if (query?.page && query?.limit) {
      const page = Number(query.page);
      const limit = Math.min(Number(query.limit), 100);
      const [data, total] = await Promise.all([
        this.prisma.owner.findMany({
          where,
          include: {
            _count: {
              select: {
                assets: {
                  where: { is_active: true, deleted_at: null, purged_at: null },
                },
              },
            },
          },
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.owner.count({ where }),
      ]);
      const dataWithCounts = await this.attachOwnerUsageCounts(orgId, data);
      const mapped = dataWithCounts.map((item: any) =>
        this.mapOwnerRelations(item),
      );
      return {
        data: await this.resolveOwnersFileUrls(mapped, orgId),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const owners = await this.prisma.owner.findMany({
      where,
      include: {
        _count: {
          select: {
            assets: {
              where: { is_active: true, deleted_at: null, purged_at: null },
            },
          },
        },
      },
      orderBy,
    });
    const ownersWithCounts = await this.attachOwnerUsageCounts(orgId, owners);
    return this.resolveOwnersFileUrls(
      ownersWithCounts.map((item: any) => this.mapOwnerRelations(item)),
      orgId,
    );
  }

  async findOne(id: string, orgId: string) {
    const owner = await this.prisma.owner.findUnique({
      where: { id },
      include: {
        users: {
          where: { is_active: true },
          select: { id: true, name: true, email: true, role: true },
        },
        assets: {
          where: { is_active: true, deleted_at: null, purged_at: null },
          select: {
            id: true,
            name: true,
            category: true,
            location: true,
            is_active: true,
            thumbnail_file_id: true,
          },
        },
      },
    });
    if (
      !owner ||
      owner.organization_id !== orgId ||
      owner.deleted_at ||
      (owner as any).purged_at
    ) {
      throw new NotFoundException('Owner no encontrado');
    }
    return this.resolveOwnerFileUrls(this.mapOwnerRelations(owner), orgId);
  }

  /** Same shape as findOne(), but for a soft-deleted owner viewed from Trash. */
  async findOneForTrash(id: string, orgId: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id, organization_id: orgId, deleted_at: { not: null } },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true },
        },
        assets: {
          select: {
            id: true,
            name: true,
            category: true,
            location: true,
            is_active: true,
            thumbnail_file_id: true,
            deleted_at: true,
            purged_at: true,
          },
        },
      },
    });

    if (!owner) {
      throw new NotFoundException('Owner no encontrado en papelera');
    }

    return this.resolveOwnerFileUrls(this.mapOwnerRelations(owner), orgId);
  }

  async update(
    id: string,
    updateOwnerDto: UpdateOwnerDto,
    orgId: string,
    logoFile?: Express.Multer.File,
  ) {
    const existingOwner = await this.prisma.owner.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
        logo_file_id: true,
        deleted_at: true,
        purged_at: true,
      },
    });

    if (
      !existingOwner ||
      existingOwner.organization_id !== orgId ||
      existingOwner.deleted_at ||
      existingOwner.purged_at
    ) {
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

    return this.resolveOwnerFileUrls(this.mapOwnerRelations(owner), orgId);
  }

  async deactivate(id: string, orgId: string) {
    const existingOwner = await this.prisma.owner.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
        deleted_at: true,
        purged_at: true,
      },
    });

    if (
      !existingOwner ||
      existingOwner.organization_id !== orgId ||
      existingOwner.deleted_at ||
      existingOwner.purged_at
    ) {
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

    return this.resolveOwnerFileUrls(
      {
        ...this.mapOwnerRelations(owner),
        deactivated_assets_count: assetsResult.count,
      },
      orgId,
    );
  }

  async remove(
    id: string,
    orgId: string,
    deletedById?: string,
    options?: { deleteAssets?: boolean; deleteServices?: boolean },
  ) {
    const existingOwner = await this.prisma.owner.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
        deleted_at: true,
        purged_at: true,
      },
    });

    if (
      !existingOwner ||
      existingOwner.organization_id !== orgId ||
      existingOwner.deleted_at ||
      existingOwner.purged_at
    ) {
      throw new NotFoundException('Owner no encontrado');
    }

    const deleteAssets =
      options?.deleteAssets === true || options?.deleteServices === true;
    const deleteServices = options?.deleteServices === true;
    const deletedAt = new Date();
    const ownerAssetIds = await this.prisma.asset.findMany({
      where: {
        organization_id: orgId,
        owner_id: id,
        deleted_at: null,
        purged_at: null,
      },
      select: { id: true },
    });
    const assetIds = ownerAssetIds.map((asset) => asset.id);

    const [owner] = await this.prisma.$transaction([
      this.prisma.owner.update({
        where: { id },
        data: {
          is_active: false,
          deleted_at: deletedAt,
          deleted_by_id: deletedById ?? null,
        },
      }),
      ...(deleteAssets
        ? [
            this.prisma.asset.updateMany({
              where: {
                organization_id: orgId,
                owner_id: id,
                deleted_at: null,
                purged_at: null,
              },
              data: {
                is_active: false,
                deleted_at: deletedAt,
                deleted_by_id: deletedById ?? null,
              },
            }),
          ]
        : []),
      ...(deleteServices && assetIds.length > 0
        ? [
            this.prisma.service.updateMany({
              where: {
                organization_id: orgId,
                asset_id: { in: assetIds },
                deleted_at: null,
                purged_at: null,
              },
              data: {
                deleted_at: deletedAt,
                deleted_by_id: deletedById ?? null,
              },
            }),
          ]
        : []),
    ]);

    return this.resolveOwnerFileUrls(this.mapOwnerRelations(owner), orgId);
  }
}
