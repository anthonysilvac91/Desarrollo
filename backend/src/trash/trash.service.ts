import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoredFilesService } from '../storage/stored-files.service';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

export interface TrashItem {
  id: string;
  entity_type: 'asset' | 'service' | 'user' | 'owner';
  name: string;
  module: string;
  deleted_at: Date;
  deleted_by: { id: string; name: string } | null;
}

@Injectable()
export class TrashService {
  constructor(
    private prisma: PrismaService,
    private storedFilesService: StoredFilesService,
  ) {}

  async getFilterOptions(orgId: string) {
    const deletedBySelect = { id: true, name: true };

    const [assetUsers, serviceUsers, usersUsers, ownerUsers] = await Promise.all([
      this.prisma.asset.findMany({
        where: { organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        select: { deleted_by: { select: deletedBySelect } },
        distinct: ['deleted_by_id'],
      }),
      this.prisma.service.findMany({
        where: { organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        select: { deleted_by: { select: deletedBySelect } },
        distinct: ['deleted_by_id'],
      }),
      this.prisma.user.findMany({
        where: { organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        select: { deleted_by: { select: deletedBySelect } },
        distinct: ['deleted_by_id'],
      }),
      this.prisma.owner.findMany({
        where: { organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        select: { deleted_by: { select: deletedBySelect } },
        distinct: ['deleted_by_id'],
      }),
    ]);

    const users = new Map<string, { id: string; name: string }>();
    [...assetUsers, ...serviceUsers, ...usersUsers, ...ownerUsers].forEach((item) => {
      if (item.deleted_by) users.set(item.deleted_by.id, item.deleted_by);
    });

    return {
      categories: ['asset', 'service', 'user', 'owner'],
      users: Array.from(users.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async findAll(orgId: string, query?: { search?: string; entity_type?: string; deleted_by_id?: string; page?: number; limit?: number }) {
    const items: TrashItem[] = [];

    const deletedBySelect = { id: true, name: true };

    const typeFilter = query?.entity_type;
    const deletedById = query?.deleted_by_id;
    const search = query?.search;
    const searchFilter = search ? { contains: search, mode: 'insensitive' as const } : undefined;

    const [assets, services, users, owners] = await Promise.all([
      !typeFilter || typeFilter === 'asset'
        ? this.prisma.asset.findMany({
            where: {
              organization_id: orgId,
              deleted_at: { not: null },
              purged_at: null,
              ...(deletedById ? { deleted_by_id: deletedById } : {}),
              ...(searchFilter ? { name: searchFilter } : {}),
            },
            include: { deleted_by: { select: deletedBySelect }, owner: { select: { name: true } } },
            orderBy: { deleted_at: 'desc' },
          })
        : [],
      !typeFilter || typeFilter === 'service'
        ? this.prisma.service.findMany({
            where: {
              organization_id: orgId,
              deleted_at: { not: null },
              purged_at: null,
              ...(deletedById ? { deleted_by_id: deletedById } : {}),
              ...(searchFilter ? { title: searchFilter } : {}),
            },
            include: { deleted_by: { select: deletedBySelect }, asset: { select: { name: true } } },
            orderBy: { deleted_at: 'desc' },
          })
        : [],
      !typeFilter || typeFilter === 'user'
        ? this.prisma.user.findMany({
            where: {
              organization_id: orgId,
              deleted_at: { not: null },
              purged_at: null,
              ...(deletedById ? { deleted_by_id: deletedById } : {}),
              ...(searchFilter ? { name: searchFilter } : {}),
            },
            include: { deleted_by: { select: deletedBySelect } },
            orderBy: { deleted_at: 'desc' },
          })
        : [],
      !typeFilter || typeFilter === 'owner'
        ? this.prisma.owner.findMany({
            where: {
              organization_id: orgId,
              deleted_at: { not: null },
              purged_at: null,
              ...(deletedById ? { deleted_by_id: deletedById } : {}),
              ...(searchFilter ? { name: searchFilter } : {}),
            },
            include: { deleted_by: { select: deletedBySelect } },
            orderBy: { deleted_at: 'desc' },
          })
        : [],
    ]);

    for (const a of assets) {
      items.push({
        id: a.id,
        entity_type: 'asset',
        name: a.name,
        module: 'assets',
        deleted_at: a.deleted_at!,
        deleted_by: a.deleted_by,
      });
    }

    for (const s of services) {
      items.push({
        id: s.id,
        entity_type: 'service',
        name: s.title,
        module: 'services',
        deleted_at: s.deleted_at!,
        deleted_by: s.deleted_by,
      });
    }

    for (const u of users) {
      items.push({
        id: u.id,
        entity_type: 'user',
        name: u.name,
        module: 'users',
        deleted_at: u.deleted_at!,
        deleted_by: u.deleted_by,
      });
    }

    for (const o of owners) {
      items.push({
        id: o.id,
        entity_type: 'owner',
        name: o.name,
        module: 'owners',
        deleted_at: o.deleted_at!,
        deleted_by: o.deleted_by,
      });
    }

    items.sort((a, b) => b.deleted_at.getTime() - a.deleted_at.getTime());

    if (query?.page && query?.limit) {
      const page = Number(query.page);
      const limit = Number(query.limit);
      const total = items.length;
      return {
        data: items.slice((page - 1) * limit, page * limit),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    return { data: items, meta: { total: items.length } };
  }

  async restore(entityType: string, id: string, orgId: string) {
    switch (entityType) {
      case 'asset': {
        const asset = await this.prisma.asset.findFirst({
          where: { id, organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        });
        if (!asset) throw new NotFoundException('Activo no encontrado en papelera');
        return this.prisma.asset.update({
          where: { id },
          data: { deleted_at: null, deleted_by_id: null, is_active: true },
        });
      }
      case 'service': {
        const service = await this.prisma.service.findFirst({
          where: { id, organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        });
        if (!service) throw new NotFoundException('Servicio no encontrado en papelera');
        return this.prisma.service.update({
          where: { id },
          data: { deleted_at: null, deleted_by_id: null },
        });
      }
      case 'user': {
        const user = await this.prisma.user.findFirst({
          where: { id, organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        });
        if (!user) throw new NotFoundException('Usuario no encontrado en papelera');
        return this.prisma.user.update({
          where: { id },
          data: { deleted_at: null, deleted_by_id: null, is_active: true },
        });
      }
      case 'owner': {
        const owner = await this.prisma.owner.findFirst({
          where: { id, organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        });
        if (!owner) throw new NotFoundException('Owner no encontrado en papelera');
        return this.prisma.owner.update({
          where: { id },
          data: { deleted_at: null, deleted_by_id: null, is_active: true },
        });
      }
      default:
        throw new NotFoundException('Tipo de entidad no válido');
    }
  }

  async permanentDelete(entityType: string, id: string, orgId: string, actorUserId?: string) {
    switch (entityType) {
      case 'asset': {
        const asset = await this.prisma.asset.findFirst({
          where: { id, organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        });
        if (!asset) throw new NotFoundException('Activo no encontrado en papelera');

        const thumbnailFileId = (asset as any).thumbnail_file_id;
        await this.prisma.workerAssetAccess.deleteMany({ where: { asset_id: id } });
        await this.prisma.asset.update({
          where: { id },
          data: {
            name: 'Asset eliminado',
            description: null,
            category: null,
            location: null,
            serial_number: null,
            thumbnail_file_id: null,
            is_active: false,
            purged_at: new Date(),
            purged_by_id: actorUserId ?? null,
          },
        });
        if (thumbnailFileId) {
          await this.storedFilesService.deleteStoredFileAndBlob(thumbnailFileId);
        }
        return { deleted: true };
      }
      case 'service': {
        const service = await this.prisma.service.findFirst({
          where: { id, organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        });
        if (!service) throw new NotFoundException('Servicio no encontrado en papelera');

        const attachments = await this.prisma.serviceAttachment.findMany({
          where: { service_id: id },
          select: { file_id: true },
        });
        await this.prisma.serviceAttachment.deleteMany({ where: { service_id: id } });
        await this.prisma.serviceShareLink.deleteMany({ where: { service_id: id } });
        await this.prisma.serviceTranslation.deleteMany({ where: { service_id: id } });
        await Promise.all(
          attachments
            .map((a) => a.file_id)
            .filter((fileId): fileId is string => !!fileId)
            .map((fileId) => this.storedFilesService.deleteStoredFileAndBlob(fileId)),
        );
        await this.prisma.service.update({
          where: { id },
          data: {
            title: 'Servicio eliminado',
            description: null,
            description_language: null,
            is_public: false,
            admin_intervened: false,
            purged_at: new Date(),
            purged_by_id: actorUserId ?? null,
          },
        });
        return { deleted: true };
      }
      case 'user': {
        const user = await this.prisma.user.findFirst({
          where: { id, organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        });
        if (!user) throw new NotFoundException('Usuario no encontrado en papelera');

        const avatarFileId = (user as any).avatar_file_id;
        const purgedAt = new Date();
        const anonymizedEmail = `deleted-${id}@deleted.local`;
        const unusablePasswordHash = await bcrypt.hash(`purged:${id}:${purgedAt.toISOString()}`, 10);
        await this.prisma.workerAssetAccess.deleteMany({ where: { worker_id: id } });
        await this.prisma.userSession.deleteMany({ where: { user_id: id } });
        await this.prisma.emailToken.deleteMany({ where: { user_id: id } });
        await this.prisma.user.update({
          where: { id },
          data: {
            name: 'Usuario eliminado',
            email: anonymizedEmail,
            phone: null,
            avatar_file_id: null,
            password_hash: unusablePasswordHash,
            owner_id: null,
            is_active: false,
            two_factor_enabled: false,
            two_factor_secret: null,
            two_factor_backup_codes: Prisma.JsonNull,
            last_login_at: null,
            email_verified_at: null,
            purged_at: purgedAt,
            purged_by_id: actorUserId ?? null,
          },
        });
        if (avatarFileId) {
          await this.storedFilesService.deleteStoredFileAndBlob(avatarFileId);
        }
        return { deleted: true };
      }
      case 'owner': {
        const owner = await this.prisma.owner.findFirst({
          where: { id, organization_id: orgId, deleted_at: { not: null }, purged_at: null },
        });
        if (!owner) throw new NotFoundException('Owner no encontrado en papelera');

        const logoFileId = (owner as any).logo_file_id;
        await this.prisma.owner.update({
          where: { id },
          data: {
            name: 'Owner eliminado',
            logo_file_id: null,
            is_active: false,
            purged_at: new Date(),
            purged_by_id: actorUserId ?? null,
          },
        });
        if (logoFileId) {
          await this.storedFilesService.deleteStoredFileAndBlob(logoFileId);
        }
        return { deleted: true };
      }
      default:
        throw new NotFoundException('Tipo de entidad no válido');
    }
  }
}
