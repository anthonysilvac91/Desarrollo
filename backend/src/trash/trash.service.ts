import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { UploadsService } from '../uploads/uploads.service';
import { AssetsService } from '../assets/assets.service';
import { ServicesService } from '../services/services.service';
import { OwnersService } from '../companies/companies.service';
import { UsersService } from '../users/users.service';
import { RealtimeService } from '../realtime/realtime.service';
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
    private uploadsService: UploadsService,
    private assetsService: AssetsService,
    private servicesService: ServicesService,
    private ownersService: OwnersService,
    private usersService: UsersService,
    @Optional() private realtimeService?: RealtimeService,
  ) {}

  async findOneDetail(entityType: string, id: string, user: any) {
    switch (entityType) {
      case 'asset':
        return this.assetsService.findOneForTrash(id, user.orgId);
      case 'service':
        return this.servicesService.findOneForTrash(id, user.orgId);
      case 'owner':
        return this.ownersService.findOneForTrash(id, user.orgId);
      case 'user':
        return this.usersService.findOne(id, {
          id: user.id,
          role: user.role,
          orgId: user.orgId,
        });
      default:
        throw new NotFoundException('Tipo de elemento no soportado');
    }
  }

  async getFilterOptions(orgId: string) {
    const deletedBySelect = { id: true, name: true };

    const [assetUsers, serviceUsers, usersUsers, ownerUsers] =
      await Promise.all([
        this.prisma.asset.findMany({
          where: {
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
          select: { deleted_by: { select: deletedBySelect } },
          distinct: ['deleted_by_id'],
        }),
        this.prisma.service.findMany({
          where: {
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
          select: { deleted_by: { select: deletedBySelect } },
          distinct: ['deleted_by_id'],
        }),
        this.prisma.user.findMany({
          where: {
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
          select: { deleted_by: { select: deletedBySelect } },
          distinct: ['deleted_by_id'],
        }),
        this.prisma.owner.findMany({
          where: {
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
          select: { deleted_by: { select: deletedBySelect } },
          distinct: ['deleted_by_id'],
        }),
      ]);

    const users = new Map<string, { id: string; name: string }>();
    [...assetUsers, ...serviceUsers, ...usersUsers, ...ownerUsers].forEach(
      (item) => {
        if (item.deleted_by) users.set(item.deleted_by.id, item.deleted_by);
      },
    );

    return {
      categories: ['asset', 'service', 'user', 'owner'],
      users: Array.from(users.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  }

  async findAll(
    orgId: string,
    query?: {
      search?: string;
      entity_type?: string;
      deleted_by_id?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const items: TrashItem[] = [];

    const deletedBySelect = { id: true, name: true };

    const typeFilter = query?.entity_type;
    const deletedById = query?.deleted_by_id;
    const search = query?.search;
    const searchFilter = search
      ? { contains: search, mode: 'insensitive' as const }
      : undefined;

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
            include: {
              deleted_by: { select: deletedBySelect },
              owner: { select: { name: true } },
            },
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
            include: {
              deleted_by: { select: deletedBySelect },
              asset: { select: { name: true } },
            },
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
      const limit = Math.min(Number(query.limit), 100);
      const total = items.length;
      return {
        data: items.slice((page - 1) * limit, page * limit),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    return { data: items, meta: { total: items.length } };
  }

  /**
   * A child row counts as "deleted together with" its parent iff it shares
   * the exact same deleted_at + deleted_by_id — that's the signature the
   * cascade-delete transactions (assets.service/companies.service `remove`)
   * stamp on every row they touch. No separate "cascade source" column
   * needed to detect it.
   */
  async getRestorePreview(entityType: string, id: string, orgId: string) {
    switch (entityType) {
      case 'asset': {
        const asset = await this.prisma.asset.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
          select: { deleted_at: true, deleted_by_id: true },
        });
        if (!asset)
          throw new NotFoundException('Activo no encontrado en papelera');

        const services = await this.prisma.service.count({
          where: {
            asset_id: id,
            organization_id: orgId,
            deleted_at: asset.deleted_at,
            deleted_by_id: asset.deleted_by_id,
            purged_at: null,
          },
        });
        return { services };
      }
      case 'owner': {
        const owner = await this.prisma.owner.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
          select: { deleted_at: true, deleted_by_id: true },
        });
        if (!owner)
          throw new NotFoundException('Owner no encontrado en papelera');

        const [assets, users] = await Promise.all([
          this.prisma.asset.findMany({
            where: {
              owner_id: id,
              organization_id: orgId,
              deleted_at: owner.deleted_at,
              deleted_by_id: owner.deleted_by_id,
              purged_at: null,
            },
            select: { id: true },
          }),
          this.prisma.user.count({
            where: {
              owner_id: id,
              role: 'EXTERNAL',
              organization_id: orgId,
              deleted_at: owner.deleted_at,
              deleted_by_id: owner.deleted_by_id,
              purged_at: null,
            },
          }),
        ]);
        const assetIds = assets.map((a) => a.id);
        const services = assetIds.length
          ? await this.prisma.service.count({
              where: {
                asset_id: { in: assetIds },
                organization_id: orgId,
                deleted_at: owner.deleted_at,
                deleted_by_id: owner.deleted_by_id,
                purged_at: null,
              },
            })
          : 0;
        return { assets: assetIds.length, services, users };
      }
      default:
        return {};
    }
  }

  async restore(
    entityType: string,
    id: string,
    orgId: string,
    options?: {
      restoreAssets?: boolean;
      restoreServices?: boolean;
      restoreUsers?: boolean;
    },
  ) {
    switch (entityType) {
      case 'asset': {
        const asset = await this.prisma.asset.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
          include: { owner: { select: { deleted_at: true, purged_at: true } } },
        });
        if (!asset)
          throw new NotFoundException('Activo no encontrado en papelera');
        if (asset.owner.deleted_at || asset.owner.purged_at) {
          throw new BadRequestException(
            'El owner de este activo sigue en la papelera. Restaura primero el owner.',
          );
        }

        const [updatedAsset] = await this.prisma.$transaction([
          this.prisma.asset.update({
            where: { id },
            data: { deleted_at: null, deleted_by_id: null, is_active: true },
          }),
          ...(options?.restoreServices
            ? [
                this.prisma.service.updateMany({
                  where: {
                    asset_id: id,
                    organization_id: orgId,
                    deleted_at: asset.deleted_at,
                    deleted_by_id: asset.deleted_by_id,
                    purged_at: null,
                  },
                  data: { deleted_at: null, deleted_by_id: null },
                }),
              ]
            : []),
        ]);
        this.realtimeService?.emit({
          module: 'assets',
          action: 'updated',
          entityId: id,
          organizationId: orgId,
        });
        if (options?.restoreServices) {
          this.realtimeService?.emit({
            module: 'services',
            action: 'updated',
            entityId: id,
            organizationId: orgId,
          });
        }
        return updatedAsset;
      }
      case 'service': {
        const service = await this.prisma.service.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
          include: {
            asset: { select: { deleted_at: true, purged_at: true } },
          },
        });
        if (!service)
          throw new NotFoundException('Servicio no encontrado en papelera');
        if (service.asset.deleted_at || service.asset.purged_at) {
          throw new BadRequestException(
            'El activo de este servicio sigue en la papelera. Restaura primero el activo.',
          );
        }
        const restoredService = await this.prisma.service.update({
          where: { id },
          data: { deleted_at: null, deleted_by_id: null },
        });
        this.realtimeService?.emit({
          module: 'services',
          action: 'updated',
          entityId: id,
          organizationId: orgId,
        });
        return restoredService;
      }
      case 'user': {
        const user = await this.prisma.user.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
        });
        if (!user)
          throw new NotFoundException('Usuario no encontrado en papelera');
        const restoredUser = await this.prisma.user.update({
          where: { id },
          data: { deleted_at: null, deleted_by_id: null, is_active: true },
        });
        this.realtimeService?.emit({
          module: 'users',
          action: 'updated',
          entityId: id,
          organizationId: orgId,
        });
        return restoredUser;
      }
      case 'owner': {
        const owner = await this.prisma.owner.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
        });
        if (!owner)
          throw new NotFoundException('Owner no encontrado en papelera');

        const restoreAssets =
          options?.restoreAssets === true || options?.restoreServices === true;
        const assetIds = restoreAssets
          ? (
              await this.prisma.asset.findMany({
                where: {
                  owner_id: id,
                  organization_id: orgId,
                  deleted_at: owner.deleted_at,
                  deleted_by_id: owner.deleted_by_id,
                  purged_at: null,
                },
                select: { id: true },
              })
            ).map((a) => a.id)
          : [];

        const [updatedOwner] = await this.prisma.$transaction([
          this.prisma.owner.update({
            where: { id },
            data: { deleted_at: null, deleted_by_id: null, is_active: true },
          }),
          ...(restoreAssets
            ? [
                this.prisma.asset.updateMany({
                  where: {
                    owner_id: id,
                    organization_id: orgId,
                    deleted_at: owner.deleted_at,
                    deleted_by_id: owner.deleted_by_id,
                    purged_at: null,
                  },
                  data: { deleted_at: null, deleted_by_id: null, is_active: true },
                }),
              ]
            : []),
          ...(options?.restoreServices && assetIds.length > 0
            ? [
                this.prisma.service.updateMany({
                  where: {
                    asset_id: { in: assetIds },
                    organization_id: orgId,
                    deleted_at: owner.deleted_at,
                    deleted_by_id: owner.deleted_by_id,
                    purged_at: null,
                  },
                  data: { deleted_at: null, deleted_by_id: null },
                }),
              ]
            : []),
          ...(options?.restoreUsers
            ? [
                this.prisma.user.updateMany({
                  where: {
                    owner_id: id,
                    role: 'EXTERNAL',
                    organization_id: orgId,
                    deleted_at: owner.deleted_at,
                    deleted_by_id: owner.deleted_by_id,
                    purged_at: null,
                  },
                  data: { deleted_at: null, deleted_by_id: null, is_active: true },
                }),
              ]
            : []),
        ]);
        this.realtimeService?.emit({
          module: 'owners',
          action: 'updated',
          entityId: id,
          organizationId: orgId,
        });
        if (restoreAssets) {
          this.realtimeService?.emit({
            module: 'assets',
            action: 'updated',
            entityId: id,
            organizationId: orgId,
          });
        }
        if (options?.restoreServices) {
          this.realtimeService?.emit({
            module: 'services',
            action: 'updated',
            entityId: id,
            organizationId: orgId,
          });
        }
        if (options?.restoreUsers) {
          this.realtimeService?.emit({
            module: 'users',
            action: 'updated',
            entityId: id,
            organizationId: orgId,
          });
        }
        return updatedOwner;
      }
      default:
        throw new NotFoundException('Tipo de entidad no válido');
    }
  }

  async permanentDelete(
    entityType: string,
    id: string,
    orgId: string,
    actorUserId?: string,
  ) {
    switch (entityType) {
      case 'asset': {
        const asset = await this.prisma.asset.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
        });
        if (!asset)
          throw new NotFoundException('Activo no encontrado en papelera');

        const thumbnailFileId = (asset as any).thumbnail_file_id;
        await this.prisma.workerAssetAccess.deleteMany({
          where: { asset_id: id },
        });
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
          await this.storedFilesService.deleteStoredFileAndBlob(
            thumbnailFileId,
          );
        }
        this.realtimeService?.emit({
          module: 'assets',
          action: 'deleted',
          entityId: id,
          organizationId: orgId,
        });
        return { deleted: true };
      }
      case 'service': {
        const service = await this.prisma.service.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
        });
        if (!service)
          throw new NotFoundException('Servicio no encontrado en papelera');

        const attachments = await this.prisma.serviceAttachment.findMany({
          where: { service_id: id },
          select: { file_id: true, thumbnail_file_id: true },
        });
        await this.prisma.serviceAttachment.deleteMany({
          where: { service_id: id },
        });
        await this.prisma.serviceShareLink.deleteMany({
          where: { service_id: id },
        });
        await this.prisma.serviceTranslation.deleteMany({
          where: { service_id: id },
        });
        await Promise.all(
          attachments
            .flatMap((a) => [a.file_id, a.thumbnail_file_id])
            .filter((fileId): fileId is string => !!fileId)
            .map((fileId) =>
              this.storedFilesService.deleteStoredFileAndBlob(fileId),
            ),
        );
        await this.uploadsService.purgeUploadsForService(id);
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
        this.realtimeService?.emit({
          module: 'services',
          action: 'deleted',
          entityId: id,
          organizationId: orgId,
        });
        return { deleted: true };
      }
      case 'user': {
        const user = await this.prisma.user.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
        });
        if (!user)
          throw new NotFoundException('Usuario no encontrado en papelera');

        const avatarFileId = (user as any).avatar_file_id;
        const purgedAt = new Date();
        const anonymizedEmail = `deleted-${id}@deleted.local`;
        const unusablePasswordHash = await bcrypt.hash(
          `purged:${id}:${purgedAt.toISOString()}`,
          10,
        );
        await this.prisma.workerAssetAccess.deleteMany({
          where: { worker_id: id },
        });
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
        this.realtimeService?.emit({
          module: 'users',
          action: 'deleted',
          entityId: id,
          organizationId: orgId,
        });
        return { deleted: true };
      }
      case 'owner': {
        const owner = await this.prisma.owner.findFirst({
          where: {
            id,
            organization_id: orgId,
            deleted_at: { not: null },
            purged_at: null,
          },
        });
        if (!owner)
          throw new NotFoundException('Owner no encontrado en papelera');

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
        this.realtimeService?.emit({
          module: 'owners',
          action: 'deleted',
          entityId: id,
          organizationId: orgId,
        });
        return { deleted: true };
      }
      default:
        throw new NotFoundException('Tipo de entidad no válido');
    }
  }
}
