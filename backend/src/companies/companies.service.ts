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
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.owner.count({ where })
      ]);
      return {
        data: await Promise.all(data.map((item: any) => this.resolveOwnerFileUrls(this.mapOwnerRelations(item)))),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    const owners = await this.prisma.owner.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });
    return Promise.all(owners.map((item: any) => this.resolveOwnerFileUrls(this.mapOwnerRelations(item))));
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

  async remove(id: string, orgId: string) {
    const existingOwner = await this.prisma.owner.findUnique({
      where: { id },
      select: { id: true, organization_id: true, logo_file_id: true },
    });

    if (!existingOwner || existingOwner.organization_id !== orgId) {
      throw new NotFoundException('Owner no encontrado');
    }

    const owner = await this.prisma.owner.update({
      where: { id: existingOwner.id },
      data: { is_active: false, logo_file_id: null },
    });

    if (existingOwner.logo_file_id) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        existingOwner.logo_file_id,
      );
    }

    return this.resolveOwnerFileUrls(this.mapOwnerRelations(owner));
  }
}
