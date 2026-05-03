import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, StoredFileKind } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { ensureNoManualFileUrl, validateImageFile } from '../common/files/image-validation';
import { processUploadedImage } from '../common/files/image-processing';
import { buildUserAvatarPath } from '../common/files/storage-paths';
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private storageGovernance: StorageGovernanceService,
    private storedFilesService: StoredFilesService,
  ) {}

  private mapUserRelations<T extends Record<string, any>>(user: T): T & { company_id: string | null; company: any; customer_id: string | null; customer: any } {
    return {
      ...user,
      company_id: user.company_id ?? user.customer_id ?? null,
      company: user.company ?? user.customer ?? null,
      customer_id: user.company_id ?? user.customer_id ?? null,
      customer: user.company ?? user.customer ?? null,
    };
  }

  private async resolveUserFileUrls<T extends Record<string, any>>(user: T) {
    const resolvedUser = { ...user } as any;
    resolvedUser.avatar_url = await this.storedFilesService.resolveFileUrlOrRef(
      resolvedUser.avatar_file_id,
      resolvedUser.avatar_url,
    );
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

  private async ensureCompanyBelongsToOrganization(companyId: string, organizationId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, organization_id: organizationId, is_active: true },
      select: { id: true },
    });

    if (!company) {
      throw new BadRequestException('La company indicada no pertenece a la organización');
    }
  }

  async findAll(query: { role?: Role; organizationId?: string; search?: string; page?: number; limit?: number }, currentUser: { id: string; role: Role; orgId?: string }) {
    // Solo SUPER_ADMIN y ADMIN pueden gestionar usuarios. 
    // WORKER puede listar pero solo si es para buscar CLIENTES.
    if (currentUser.role !== Role.SUPER_ADMIN && currentUser.role !== Role.ADMIN) {
      if (currentUser.role === Role.WORKER) {
        query.role = Role.CLIENT; // Forzamos que solo vea clientes
      } else {
        throw new ForbiddenException('No tienes permiso para gestionar usuarios');
      }
    }

    const where: any = {};

    // Filtro por rol si se provee
    if (query.role) {
      where.role = query.role;
    }

    // Aislamiento Multi-tenant
    if (currentUser.role === Role.SUPER_ADMIN) {
      // Si es SUPER_ADMIN, puede filtrar opcionalmente por orgId
      if (query.organizationId) {
        where.organization_id = query.organizationId;
      }
    } else {
      // Si es ADMIN, forzar su propia organización
      where.organization_id = currentUser.orgId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const selectFields = {
      id: true,
      organization_id: true,
      role: true,
      email: true,
      name: true,
      phone: true,
      avatar_file_id: true,
      avatar_url: true,
      is_active: true,
      last_login_at: true,
      created_at: true,
      updated_at: true,
      organization: { select: { id: true, name: true, slug: true } },
      company: { select: { id: true, name: true } },
    };

    if (query.page && query.limit) {
      const page = Number(query.page);
      const limit = Number(query.limit);
      const [data, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          orderBy: { created_at: 'desc' },
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
      orderBy: { created_at: 'desc' },
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
        avatar_url: true,
        company_id: true,
        organization: { select: { id: true, name: true, slug: true } },
        company: { select: { id: true, name: true } },
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
    // 1. Validar permisos de creación por rol
    if (currentUser.role === Role.ADMIN) {
      // Un admin no puede crear un SuperAdmin
      if (dto.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException('Un administrador no puede crear un Super Administrador');
      }
      // Forzar organización del admin
      dto.organization_id = currentUser.orgId;
    } else if (currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('No tienes permisos para crear usuarios');
    }

    if (dto.role === Role.SUPER_ADMIN) {
      if (dto.organization_id || dto.company_id) {
        throw new BadRequestException('Un SUPER_ADMIN no puede asociarse a una organización o company');
      }
    } else {
      if (!dto.organization_id) {
        throw new BadRequestException('Los usuarios no SUPER_ADMIN deben pertenecer a una organización');
      }

      await this.ensureOrganizationExists(dto.organization_id);
    }

    if (dto.company_id) {
      if (dto.role !== Role.CLIENT) {
        throw new BadRequestException('Solo un usuario con rol CLIENT puede asociarse a una company');
      }

      await this.ensureCompanyBelongsToOrganization(dto.company_id, dto.organization_id!);
    }

    // 2. Verificar email duplicado en el mismo tenant (u org_id null para SuperAdmin)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        organization_id: dto.organization_id || null
      }
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado en esta organización');
    }

    // 3. Hashear password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 4. Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password_hash: passwordHash,
        name: dto.name,
        role: dto.role,
        organization_id: dto.organization_id || null,
        company_id: dto.company_id || null,
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization_id: true,
        company_id: true,
        is_active: true,
        created_at: true,
      }
    });

    return this.mapUserRelations(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    currentUser: { id: string; role: Role; orgId?: string },
    avatarFile?: Express.Multer.File
  ) {
    const currentUserRecord = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
        role: true,
        company_id: true,
        avatar_file_id: true,
        avatar_url: true,
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

    if (dto.company_id !== undefined) {
      if (currentUserRecord.role !== Role.CLIENT) {
        throw new BadRequestException('Solo un usuario con rol CLIENT puede asociarse a una company');
      }

      await this.ensureCompanyBelongsToOrganization(dto.company_id, targetOrganizationId!);
    } else if (organizationChanged && currentUserRecord.company_id) {
      data.company_id = null;
    }

    let avatarFileId = currentUserRecord.avatar_file_id;

    if (avatarFile) {
      const organizationId = targetOrganizationId;
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
        folder: buildUserAvatarPath(
          organizationId,
          currentUserRecord.id,
        ),
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
        ownerType: 'USER',
        ownerId: currentUserRecord.id,
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
          company_id: true,
          avatar_file_id: true,
          avatar_url: true,
          is_active: true,
          organization: { select: { id: true, name: true, slug: true } },
          company: { select: { id: true, name: true } },
        }
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
