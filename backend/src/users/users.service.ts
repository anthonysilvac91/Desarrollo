import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, StoredFileKind } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import * as bcrypt from 'bcryptjs';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import {
  ensureNoManualFileUrl,
  validateImageFile,
} from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildUserAvatarPath } from '../common/files/storage-paths';
import {
  hasLegacyOwnerAliases,
  isExternalRole,
  LEGACY_OWNER_ALIAS_MESSAGE,
  toDbRole,
  withOwner,
} from '../common/compat/owner-role-compat';
import { RealtimeService } from '../realtime/realtime.service';
import { EmailService } from '../email/email.service';
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
    private emailService: EmailService,
    @Optional() private realtimeService?: RealtimeService,
  ) {}

  private mapUserRelations<T extends Record<string, any>>(
    user: T,
  ): T & { owner_id: string | null; owner: any } {
    return withOwner(user);
  }

  private async resolveUserFileUrls<T extends Record<string, any>>(user: T) {
    const resolvedUser = { ...user } as any;
    resolvedUser.avatar_url =
      await this.storedFilesService.resolveFileUrlForOrg(
        resolvedUser.avatar_file_id,
        resolvedUser.organization_id,
      );
    return resolvedUser;
  }

  private async resolveUsersFileUrls<T extends Record<string, any>>(
    users: T[],
  ): Promise<T[]> {
    if (users.length === 0) return [];
    const fileIdsByOrg = new Map<string, Array<string | null | undefined>>();
    for (const user of users) {
      const orgId: string = (user as any).organization_id;
      if (!fileIdsByOrg.has(orgId)) fileIdsByOrg.set(orgId, []);
      fileIdsByOrg.get(orgId)!.push((user as any).avatar_file_id);
    }
    const urlMapsByOrg = new Map<string, Map<string, string | null>>();
    await Promise.all(
      [...fileIdsByOrg.entries()].map(async ([orgId, ids]) => {
        urlMapsByOrg.set(
          orgId,
          await this.storedFilesService.resolveFileUrlsForOrg(ids, orgId),
        );
      }),
    );
    return users.map((user) => {
      const u = user as any;
      const urlMap = urlMapsByOrg.get(u.organization_id) ?? new Map();
      return { ...u, avatar_url: urlMap.get(u.avatar_file_id) ?? null } as T;
    });
  }

  private async ensureOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, is_active: true },
    });

    if (!organization || !organization.is_active) {
      throw new BadRequestException(
        'La organización indicada no existe o está inactiva',
      );
    }
  }

  private async ensureOwnerBelongsToOrganization(
    ownerId: string,
    organizationId: string,
  ) {
    const owner = await this.prisma.owner.findFirst({
      where: { id: ownerId, organization_id: organizationId, is_active: true },
      select: { id: true },
    });

    if (!owner) {
      throw new BadRequestException(
        'El propietario indicado no pertenece a la organización',
      );
    }
  }

  private buildStatsWhere(currentUser: { role: Role; orgId?: string }) {
    const where: any = { deleted_at: null, purged_at: null };

    if (currentUser.role !== Role.SUPER_ADMIN) {
      if (!currentUser.orgId) {
        throw new ForbiddenException(
          'El usuario no pertenece a ninguna organizacion',
        );
      }

      where.organization_id = currentUser.orgId;
      where.AND = [{ role: { not: Role.SUPER_ADMIN } }];
    }

    return where;
  }

  async getStats(currentUser: { id: string; role: Role; orgId?: string }) {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'No tienes permiso para ver estadisticas de usuarios',
      );
    }

    const where = this.buildStatsWhere(currentUser);
    const [total, groupedRoles] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['role'],
        where,
        _count: { role: true },
      }),
    ]);

    const countsByRole = groupedRoles.reduce<Record<Role, number>>(
      (acc, item) => {
        acc[item.role] = item._count.role;
        return acc;
      },
      {
        [Role.SUPER_ADMIN]: 0,
        [Role.ADMIN]: 0,
        [Role.WORKER]: 0,
        [Role.EXTERNAL]: 0,
      },
    );

    return {
      total_users: total,
      super_admins: countsByRole[Role.SUPER_ADMIN],
      admins: countsByRole[Role.ADMIN],
      workers: countsByRole[Role.WORKER],
      external_users: countsByRole[Role.EXTERNAL],
    };
  }

  async findAll(
    query: {
      role?: Role | 'EXTERNAL';
      organizationId?: string;
      search?: string;
      isActive?: string;
      page?: number;
      limit?: number;
    },
    currentUser: { id: string; role: Role; orgId?: string },
  ) {
    // Solo SUPER_ADMIN y ADMIN pueden gestionar usuarios.
    // WORKER puede listar pero solo si es para buscar owners externos.
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.ADMIN
    ) {
      if (currentUser.role === Role.WORKER) {
        query.role = Role.EXTERNAL; // Forzamos que solo vea usuarios externos
      } else {
        throw new ForbiddenException(
          'No tienes permiso para gestionar usuarios',
        );
      }
    }

    const where: any = { deleted_at: null, purged_at: null };

    // Filtro por rol si se provee
    if (query.role) {
      where.role = toDbRole(query.role);
    }

    if (currentUser.role !== Role.SUPER_ADMIN) {
      where.AND = [...(where.AND ?? []), { role: { not: Role.SUPER_ADMIN } }];
    }

    // Aislamiento Multi-tenant
    if (currentUser.role === Role.SUPER_ADMIN) {
      // Si es SUPER_ADMIN, puede filtrar opcionalmente por orgId
      if (query.organizationId) {
        where.organization_id = query.organizationId;
      }
    } else {
      // Si es ADMIN, forzar su propia organización
      if (!currentUser.orgId) {
        throw new ForbiddenException(
          'El usuario no pertenece a ninguna organizacion',
        );
      }
      where.organization_id = currentUser.orgId;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    if (query.isActive === 'true') {
      where.is_active = true;
    } else if (query.isActive === 'false') {
      where.is_active = false;
    }

    const selectFields = {
      id: true,
      organization_id: true,
      role: true,
      email: true,
      name: true,
      phone: true,
      avatar_file_id: true,
      is_active: true,
      last_login_at: true,
      created_at: true,
      updated_at: true,
      organization: { select: { id: true, name: true, slug: true } },
      owner: {
        select: { id: true, name: true, deleted_at: true, purged_at: true },
      },
    };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Number(query.limit) || 50, 100);
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ is_active: 'desc' }, { updated_at: 'desc' }],
        select: selectFields,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    const mapped = data.map((item: any) => this.mapUserRelations(item));
    const mappedData = await this.resolveUsersFileUrls(mapped);

    return {
      data: mappedData,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    id: string,
    currentUser: { id: string; role: Role; orgId?: string },
  ) {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'No tienes permiso para ver detalles de usuarios',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
        role: true,
        email: true,
        name: true,
        phone: true,
        avatar_file_id: true,
        owner_id: true,
        organization: { select: { id: true, name: true, slug: true } },
        owner: {
          select: { id: true, name: true, deleted_at: true, purged_at: true },
        },
        is_active: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
        asset_access_mode: true,
        language: true,
        security_alerts_enabled: true,
        worker_asset_access: { select: { asset_id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validación de pertenencia a tenant para ADMIN
    if (
      currentUser.role === Role.ADMIN &&
      user.organization_id !== currentUser.orgId
    ) {
      throw new ForbiddenException(
        'No tienes acceso a usuarios de otra organización',
      );
    }

    const { worker_asset_access, ...userWithoutAccess } = user;
    const userWithAssetAccess = {
      ...userWithoutAccess,
      asset_access: worker_asset_access.map((access) => access.asset_id),
    };

    return this.resolveUserFileUrls(this.mapUserRelations(userWithAssetAccess));
  }

  async setAssetAccess(
    id: string,
    assetIds: string[],
    currentUser: { id: string; role: Role; orgId?: string },
    mode?: 'UNRESTRICTED' | 'RESTRICTED',
  ) {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'No tienes permiso para gestionar el acceso a activos',
      );
    }

    const worker = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, organization_id: true },
    });

    if (!worker) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (
      currentUser.role === Role.ADMIN &&
      worker.organization_id !== currentUser.orgId
    ) {
      throw new ForbiddenException(
        'No tienes acceso a usuarios de otra organización',
      );
    }

    if (worker.role !== Role.WORKER) {
      throw new BadRequestException(
        'Solo se puede asignar acceso a activos a usuarios con rol Worker',
      );
    }

    // UNRESTRICTED ignores whatever list was sent — the worker sees everything.
    const effectiveMode = mode ?? 'RESTRICTED';
    const uniqueAssetIds =
      effectiveMode === 'UNRESTRICTED' ? [] : Array.from(new Set(assetIds));
    if (uniqueAssetIds.length > 0) {
      const matchingAssetsCount = await this.prisma.asset.count({
        where: {
          id: { in: uniqueAssetIds },
          organization_id: worker.organization_id!,
        },
      });
      if (matchingAssetsCount !== uniqueAssetIds.length) {
        throw new BadRequestException(
          'Uno o mas activos no pertenecen a la organización del worker',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { asset_access_mode: effectiveMode },
      }),
      this.prisma.workerAssetAccess.deleteMany({
        where: { worker_id: id },
      }),
      ...(uniqueAssetIds.length > 0
        ? [
            this.prisma.workerAssetAccess.createMany({
              data: uniqueAssetIds.map((assetId) => ({
                worker_id: id,
                asset_id: assetId,
                organization_id: worker.organization_id!,
                granted_by_id: currentUser.id,
              })),
            }),
          ]
        : []),
    ]);

    return { asset_access_mode: effectiveMode, asset_access: uniqueAssetIds };
  }

  async create(
    dto: CreateUserDto,
    currentUser: { id: string; role: Role; orgId?: string },
  ) {
    const requestedRole = dto.role;
    const dbRole = toDbRole(requestedRole);
    if (hasLegacyOwnerAliases(dto)) {
      throw new BadRequestException(LEGACY_OWNER_ALIAS_MESSAGE);
    }
    const ownerId = dto.owner_id ?? null;
    // 1. Validar permisos de creación por rol
    if (currentUser.role === Role.ADMIN) {
      // Un admin no puede crear un SuperAdmin
      if (dbRole === Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Un administrador no puede crear un Super Administrador',
        );
      }
      // Forzar organización del admin
      dto.organization_id = currentUser.orgId;
    } else if (currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('No tienes permisos para crear usuarios');
    }

    if (dbRole === Role.SUPER_ADMIN) {
      if (dto.organization_id || ownerId) {
        throw new BadRequestException(
          'Un SUPER_ADMIN no puede asociarse a una organización o owner',
        );
      }
    } else {
      if (!dto.organization_id) {
        throw new BadRequestException(
          'Los usuarios no SUPER_ADMIN deben pertenecer a una organización',
        );
      }

      await this.ensureOrganizationExists(dto.organization_id);
    }

    if (ownerId) {
      if (!isExternalRole(requestedRole)) {
        throw new BadRequestException(
          'Solo un usuario externo puede asociarse a un owner',
        );
      }

      await this.ensureOwnerBelongsToOrganization(
        ownerId,
        dto.organization_id!,
      );
    }

    if (isExternalRole(requestedRole) && !ownerId) {
      throw new BadRequestException(
        'Un usuario externo debe asociarse a un owner',
      );
    }

    // 2. Verificar email duplicado globalmente (User.email es @unique en toda la plataforma)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado en Fentri');
    }

    // 3. Hashear password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 4. Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password_hash: passwordHash,
        name: dto.name,
        role: dbRole,
        organization_id: dto.organization_id || null,
        owner_id: ownerId,
        is_active: true,
        ...(dbRole === Role.WORKER && dto.asset_access_mode
          ? { asset_access_mode: dto.asset_access_mode }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization_id: true,
        owner_id: true,
        is_active: true,
        created_at: true,
      },
    });

    const mappedUser = this.mapUserRelations(user);
    this.realtimeService?.emit({
      module: 'users',
      action: 'created',
      entityId: user.id,
      organizationId: user.organization_id,
      actorUserId: currentUser.id,
    });

    return mappedUser;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    currentUser: { id: string; role: Role; orgId?: string },
  ) {
    const currentUserRecord = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
        role: true,
        owner_id: true,
      },
    });

    if (!currentUserRecord) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (
      currentUser.role === Role.ADMIN &&
      currentUserRecord.organization_id !== currentUser.orgId
    ) {
      throw new ForbiddenException(
        'No tienes acceso a usuarios de otra organizaciÃ³n',
      );
    }

    ensureNoManualFileUrl(dto.avatar_url, 'Avatar de usuario');
    const data: any = { ...dto };
    delete data.avatar_url;
    delete data.owner_id;

    const organizationChanged =
      dto.organization_id !== undefined &&
      dto.organization_id !== currentUserRecord.organization_id;
    const targetOrganizationId =
      dto.organization_id ?? currentUserRecord.organization_id;

    if (dto.organization_id !== undefined) {
      if (currentUser.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Solo SUPER_ADMIN puede cambiar la organizacion de un usuario',
        );
      }

      if (currentUserRecord.role === Role.SUPER_ADMIN) {
        throw new BadRequestException(
          'Un SUPER_ADMIN no puede asociarse a una organizacion',
        );
      }

      await this.ensureOrganizationExists(dto.organization_id);
    }

    if (currentUserRecord.role !== Role.SUPER_ADMIN && !targetOrganizationId) {
      throw new BadRequestException(
        'Los usuarios no SUPER_ADMIN deben pertenecer a una organizacion',
      );
    }

    const ownerProvided = dto.owner_id !== undefined;
    if (hasLegacyOwnerAliases(dto)) {
      throw new BadRequestException(LEGACY_OWNER_ALIAS_MESSAGE);
    }
    const ownerId = dto.owner_id ?? null;

    if (ownerProvided) {
      if (!isExternalRole(currentUserRecord.role)) {
        throw new BadRequestException(
          'Solo un usuario externo puede asociarse a un owner',
        );
      }

      if (!ownerId) {
        throw new BadRequestException(
          'Un usuario externo debe asociarse a un owner',
        );
      }

      await this.ensureOwnerBelongsToOrganization(
        ownerId,
        targetOrganizationId!,
      );
      data.owner_id = ownerId;
    } else if (organizationChanged && currentUserRecord.owner_id) {
      data.owner_id = null;
    }

    const targetOwnerId =
      data.owner_id !== undefined ? data.owner_id : currentUserRecord.owner_id;
    if (isExternalRole(currentUserRecord.role) && !targetOwnerId) {
      throw new BadRequestException(
        'Un usuario externo debe asociarse a un owner',
      );
    }

    if (
      data.asset_access_mode !== undefined &&
      currentUserRecord.role !== Role.WORKER
    ) {
      delete data.asset_access_mode;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: currentUserRecord.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        organization_id: true,
        owner_id: true,
        avatar_file_id: true,
        is_active: true,
        organization: { select: { id: true, name: true, slug: true } },
        owner: {
          select: { id: true, name: true, deleted_at: true, purged_at: true },
        },
      },
    });

    return this.resolveUserFileUrls(this.mapUserRelations(updatedUser));
  }

  async updateOwnProfile(
    currentUser: { id: string; role: Role; orgId?: string },
    dto: UpdateOwnProfileDto,
    avatarFile?: Express.Multer.File,
  ) {
    const currentUserRecord = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        email: true,
        password_hash: true,
        organization_id: true,
        role: true,
        owner_id: true,
        avatar_file_id: true,
      },
    });

    if (!currentUserRecord) {
      throw new NotFoundException('Usuario no encontrado');
    }

    ensureNoManualFileUrl(dto.avatar_url, 'Avatar de usuario');

    const data: any = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== currentUserRecord.email) {
        const existingUser = await this.prisma.user.findFirst({
          where: { email, id: { not: currentUserRecord.id } },
          select: { id: true },
        });

        if (existingUser) {
          throw new ConflictException('Ya existe un usuario con ese email');
        }
      }
      data.email = email;
    }

    if (dto.phone !== undefined) {
      const phone = dto.phone.trim();
      data.phone = phone || null;
    }

    if (dto.new_password) {
      if (!dto.current_password) {
        throw new BadRequestException('Debes ingresar tu contrasena actual');
      }

      const passwordMatches = await bcrypt.compare(
        dto.current_password,
        currentUserRecord.password_hash,
      );

      if (!passwordMatches) {
        throw new ForbiddenException('La contrasena actual no es correcta');
      }

      data.password_hash = await bcrypt.hash(dto.new_password, 10);
    }

    let avatarFileId = currentUserRecord.avatar_file_id;

    if (dto.remove_avatar === 'true' && !avatarFile) {
      avatarFileId = null;
    }

    if (avatarFile) {
      const organizationId = currentUserRecord.organization_id;
      if (!organizationId) {
        throw new BadRequestException(
          'No se puede subir avatar para usuarios sin organizacion',
        );
      }

      const imageInfo = validateImageFile(avatarFile, {
        maxBytes: 2 * 1024 * 1024,
        label: 'Avatar de usuario',
        maxWidth: 4096,
        maxHeight: 4096,
        maxPixels: 12 * 1024 * 1024,
      });
      avatarFile.mimetype = imageInfo.mime;
      await processUploadedImage(avatarFile, {
        maxWidth: 512,
        maxHeight: 512,
        format: 'webp',
        quality: 86,
      });
      await this.storageGovernance.assertCanStore(
        organizationId,
        avatarFile.size,
        currentUserRecord.avatar_file_id
          ? [currentUserRecord.avatar_file_id]
          : [],
      );

      const avatarUrl = await this.storageService.uploadFile(avatarFile, {
        folder: buildUserAvatarPath(organizationId, currentUserRecord.id),
        visibility: 'private',
      });
      const storedFile = await this.storedFilesService.registerUploadedFile({
        organizationId,
        storageRef: avatarUrl,
        originalName: avatarFile.originalname,
        mimeType: avatarFile.mimetype,
        sizeBytes: avatarFile.size,
        kind: StoredFileKind.USER_AVATAR,
        visibility: 'private',
        entityType: 'USER',
        entityId: currentUserRecord.id,
        uploadedByUserId: currentUser.id,
      });
      avatarFileId = storedFile.id;
    }

    let updatedUser;
    try {
      updatedUser = await this.prisma.user.update({
        where: { id: currentUserRecord.id },
        data: {
          ...data,
          avatar_file_id: avatarFileId,
          ...(dto.language ? { language: dto.language } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          organization_id: true,
          owner_id: true,
          avatar_file_id: true,
          is_active: true,
          security_alerts_enabled: true,
          organization: { select: { id: true, name: true, slug: true } },
          owner: {
            select: { id: true, name: true, deleted_at: true, purged_at: true },
          },
        },
      });
    } catch (error) {
      if (
        avatarFile &&
        avatarFileId &&
        avatarFileId !== currentUserRecord.avatar_file_id
      ) {
        await this.storedFilesService.deleteStoredFileAndBlob(avatarFileId);
      }
      throw error;
    }

    if (
      (avatarFile || dto.remove_avatar === 'true') &&
      currentUserRecord.avatar_file_id
    ) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        currentUserRecord.avatar_file_id,
      );
    }

    if (dto.new_password && updatedUser.security_alerts_enabled) {
      this.emailService
        .sendPasswordChanged(updatedUser.email, updatedUser.name, dto.language)
        .catch((err) =>
          this.logger.error('Failed to send password-changed notice', err),
        );
    }

    return this.resolveUserFileUrls(this.mapUserRelations(updatedUser));
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.email_notifications_enabled !== undefined
          ? { email_notifications_enabled: dto.email_notifications_enabled }
          : {}),
        ...(dto.security_alerts_enabled !== undefined
          ? { security_alerts_enabled: dto.security_alerts_enabled }
          : {}),
      },
      select: {
        email_notifications_enabled: true,
        security_alerts_enabled: true,
      },
    });
  }

  async toggleStatus(
    id: string,
    currentUser: { id: string; role: Role; orgId?: string },
  ) {
    if (id === currentUser.id) {
      throw new ForbiddenException(
        'No puedes cambiar el estado de tu propio usuario',
      );
    }

    const user = await this.findOne(id, currentUser);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { is_active: !user.is_active },
      select: {
        id: true,
        email: true,
        is_active: true,
      },
    });

    if (user.organization?.name && user.security_alerts_enabled) {
      this.emailService
        .sendUserStatusChanged(
          updatedUser.email,
          user.name,
          user.organization.name,
          updatedUser.is_active,
          user.language as 'en' | 'es',
        )
        .catch((err) =>
          this.logger.error(
            `Failed to send user-status notice to ${updatedUser.email}`,
            err,
          ),
        );
    }

    return updatedUser;
  }

  async softDelete(
    id: string,
    currentUser: { id: string; role: Role; orgId?: string },
  ) {
    if (id === currentUser.id) {
      throw new ForbiddenException('No puedes eliminar tu propio usuario');
    }

    const user = await this.findOne(id, currentUser);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        is_active: false,
        deleted_at: new Date(),
        deleted_by_id: currentUser.id,
      },
    });

    return updatedUser;
  }
}
