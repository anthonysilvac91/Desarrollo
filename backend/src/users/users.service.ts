import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, StoredFileKind } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import * as bcrypt from 'bcryptjs';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { ensureNoManualFileUrl, validateImageFile } from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildUserAvatarPath } from '../common/files/storage-paths';
import {
  hasLegacyOwnerAliases,
  isExternalRole,
  LEGACY_OWNER_ALIAS_MESSAGE,
  toDbRole,
  withOwner,
} from '../common/compat/owner-role-compat';
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
  ) {}

  private mapUserRelations<T extends Record<string, any>>(user: T): T & { owner_id: string | null; owner: any } {
    return withOwner(user);
  }

  private async resolveUserFileUrls<T extends Record<string, any>>(user: T) {
    const resolvedUser = { ...user } as any;
    resolvedUser.avatar_url = await this.storedFilesService.resolveFileUrlForOrg(resolvedUser.avatar_file_id, resolvedUser.organization_id);
    return resolvedUser;
  }

  private async ensureOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, is_active: true },
    });

    if (!organization || !organization.is_active) {
      throw new BadRequestException('La organización indicada no existe o está inactiva');
    }
  }

  private async ensureOwnerBelongsToOrganization(ownerId: string, organizationId: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id: ownerId, organization_id: organizationId, is_active: true },
      select: { id: true },
    });

    if (!owner) {
      throw new BadRequestException('El propietario indicado no pertenece a la organización');
    }
  }

  private buildStatsWhere(currentUser: { role: Role; orgId?: string }) {
    const where: any = {};

    if (currentUser.role !== Role.SUPER_ADMIN) {
      if (!currentUser.orgId) {
        throw new ForbiddenException('El usuario no pertenece a ninguna organizacion');
      }

      where.organization_id = currentUser.orgId;
      where.AND = [{ role: { not: Role.SUPER_ADMIN } }];
    }

    return where;
  }

  async getStats(currentUser: { id: string; role: Role; orgId?: string }) {
    if (currentUser.role !== Role.SUPER_ADMIN && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('No tienes permiso para ver estadisticas de usuarios');
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

    const countsByRole = groupedRoles.reduce<Record<Role, number>>((acc, item) => {
      acc[item.role] = item._count.role;
      return acc;
    }, {
      [Role.SUPER_ADMIN]: 0,
      [Role.ADMIN]: 0,
      [Role.WORKER]: 0,
      [Role.EXTERNAL]: 0,
    });

    return {
      total_users: total,
      super_admins: countsByRole[Role.SUPER_ADMIN],
      admins: countsByRole[Role.ADMIN],
      workers: countsByRole[Role.WORKER],
      external_users: countsByRole[Role.EXTERNAL],
    };
  }

  async findAll(query: { role?: Role | 'EXTERNAL'; organizationId?: string; search?: string; isActive?: string; page?: number; limit?: number }, currentUser: { id: string; role: Role; orgId?: string }) {
    // Solo SUPER_ADMIN y ADMIN pueden gestionar usuarios. 
    // WORKER puede listar pero solo si es para buscar owners externos.
    if (currentUser.role !== Role.SUPER_ADMIN && currentUser.role !== Role.ADMIN) {
      if (currentUser.role === Role.WORKER) {
        query.role = Role.EXTERNAL; // Forzamos que solo vea usuarios externos
      } else {
        throw new ForbiddenException('No tienes permiso para gestionar usuarios');
      }
    }

    const where: any = {};

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
        throw new ForbiddenException('El usuario no pertenece a ninguna organizacion');
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
      owner: { select: { id: true, name: true } },
    };

    if (query.page && query.limit) {
      const page = Number(query.page);
      const limit = Number(query.limit);
      const [data, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          orderBy: [{ is_active: 'desc' }, { updated_at: 'desc' }],
          select: selectFields,
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.user.count({ where })
      ]);
      const mappedData = await Promise.all(
        data.map(async (item: any) => this.resolveUserFileUrls(this.mapUserRelations(item)))
      );

      return {
        data: mappedData,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ is_active: 'desc' }, { updated_at: 'desc' }],
      select: selectFields,
    });

    return Promise.all(
      users.map(async (item: any) => this.resolveUserFileUrls(this.mapUserRelations(item)))
    );
  }

  async findOne(id: string, currentUser: { id: string; role: Role; orgId?: string }) {
    if (currentUser.role !== Role.SUPER_ADMIN && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('No tienes permiso para ver detalles de usuarios');
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
        owner: { select: { id: true, name: true } },
        is_active: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validación de pertenencia a tenant para ADMIN
    if (currentUser.role === Role.ADMIN && user.organization_id !== currentUser.orgId) {
      throw new ForbiddenException('No tienes acceso a usuarios de otra organización');
    }

    return this.resolveUserFileUrls(this.mapUserRelations(user));
  }

  async create(dto: CreateUserDto, currentUser: { id: string; role: Role; orgId?: string }) {
    const requestedRole = dto.role;
    const dbRole = toDbRole(requestedRole) as Role;
    if (hasLegacyOwnerAliases(dto)) {
      throw new BadRequestException(LEGACY_OWNER_ALIAS_MESSAGE);
    }
    const ownerId = dto.owner_id ?? null;
    // 1. Validar permisos de creación por rol
    if (currentUser.role === Role.ADMIN) {
      // Un admin no puede crear un SuperAdmin
      if (dbRole === Role.SUPER_ADMIN) {
        throw new ForbiddenException('Un administrador no puede crear un Super Administrador');
      }
      // Forzar organización del admin
      dto.organization_id = currentUser.orgId;
    } else if (currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('No tienes permisos para crear usuarios');
    }

    if (dbRole === Role.SUPER_ADMIN) {
      if (dto.organization_id || ownerId) {
        throw new BadRequestException('Un SUPER_ADMIN no puede asociarse a una organización o owner');
      }
    } else {
      if (!dto.organization_id) {
        throw new BadRequestException('Los usuarios no SUPER_ADMIN deben pertenecer a una organización');
      }

      await this.ensureOrganizationExists(dto.organization_id);
    }

    if (ownerId) {
      if (!isExternalRole(requestedRole)) {
        throw new BadRequestException('Solo un usuario externo puede asociarse a un owner');
      }

      await this.ensureOwnerBelongsToOrganization(ownerId, dto.organization_id!);
    }

    if (isExternalRole(requestedRole) && !ownerId) {
      throw new BadRequestException('Un usuario externo debe asociarse a un owner');
    }

    // 2. Verificar email duplicado globalmente (User.email es @unique en toda la plataforma)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado en Recall');
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
      }
    });

    return this.mapUserRelations(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    currentUser: { id: string; role: Role; orgId?: string }
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

    if (currentUser.role === Role.ADMIN && currentUserRecord.organization_id !== currentUser.orgId) {
      throw new ForbiddenException('No tienes acceso a usuarios de otra organizaciÃ³n');
    }

    ensureNoManualFileUrl(dto.avatar_url, 'Avatar de usuario');
    const data: any = { ...dto };
    delete data.avatar_url;
    delete data.owner_id;

    const organizationChanged =
      dto.organization_id !== undefined &&
      dto.organization_id !== currentUserRecord.organization_id;
    const targetOrganizationId = dto.organization_id ?? currentUserRecord.organization_id;

    if (dto.organization_id !== undefined) {
      if (currentUser.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Solo SUPER_ADMIN puede cambiar la organizacion de un usuario');
      }

      if (currentUserRecord.role === Role.SUPER_ADMIN) {
        throw new BadRequestException('Un SUPER_ADMIN no puede asociarse a una organizacion');
      }

      await this.ensureOrganizationExists(dto.organization_id);
    }

    if (currentUserRecord.role !== Role.SUPER_ADMIN && !targetOrganizationId) {
      throw new BadRequestException('Los usuarios no SUPER_ADMIN deben pertenecer a una organizacion');
    }

    const ownerProvided =
      dto.owner_id !== undefined;
    if (hasLegacyOwnerAliases(dto)) {
      throw new BadRequestException(LEGACY_OWNER_ALIAS_MESSAGE);
    }
    const ownerId = dto.owner_id ?? null;

    if (ownerProvided) {
      if (!isExternalRole(currentUserRecord.role)) {
        throw new BadRequestException('Solo un usuario externo puede asociarse a un owner');
      }

      if (!ownerId) {
        throw new BadRequestException('Un usuario externo debe asociarse a un owner');
      }

      await this.ensureOwnerBelongsToOrganization(ownerId, targetOrganizationId!);
      data.owner_id = ownerId;
    } else if (organizationChanged && currentUserRecord.owner_id) {
      data.owner_id = null;
    }

    const targetOwnerId =
      data.owner_id !== undefined ? data.owner_id : currentUserRecord.owner_id;
    if (isExternalRole(currentUserRecord.role) && !targetOwnerId) {
      throw new BadRequestException('Un usuario externo debe asociarse a un owner');
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
        owner: { select: { id: true, name: true } },
      }
    });

    return this.resolveUserFileUrls(this.mapUserRelations(updatedUser));
  }

  async updateOwnProfile(
    currentUser: { id: string; role: Role; orgId?: string },
    dto: UpdateOwnProfileDto,
    avatarFile?: Express.Multer.File
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

    if (avatarFile) {
      const organizationId = currentUserRecord.organization_id;
      if (!organizationId) {
        throw new BadRequestException('No se puede subir avatar para usuarios sin organizacion');
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
        currentUserRecord.avatar_file_id ? [currentUserRecord.avatar_file_id] : [],
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
          organization: { select: { id: true, name: true, slug: true } },
          owner: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      if (avatarFile && avatarFileId && avatarFileId !== currentUserRecord.avatar_file_id) {
        await this.storedFilesService.deleteStoredFileAndBlob(avatarFileId);
      }
      throw error;
    }

    if (avatarFile && currentUserRecord.avatar_file_id) {
      await this.storedFilesService.deleteStoredFileAndBlob(
        currentUserRecord.avatar_file_id,
      );
    }

    return this.resolveUserFileUrls(this.mapUserRelations(updatedUser));
  }

  async toggleStatus(id: string, currentUser: { id: string; role: Role; orgId?: string }) {
    if (id === currentUser.id) {
      throw new ForbiddenException('No puedes cambiar el estado de tu propio usuario');
    }

    const user = await this.findOne(id, currentUser);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { is_active: !user.is_active },
      select: {
        id: true,
        email: true,
        is_active: true,
      }
    });

    return updatedUser;
  }
}
