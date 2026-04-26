import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private mapUserRelations<T extends Record<string, any>>(user: T): T & { company_id: string | null; company: any } {
    return {
      ...user,
      company_id: user.customer_id ?? null,
      company: user.customer ?? null,
    };
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

  private async ensureCustomerBelongsToOrganization(customerId: string, organizationId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organization_id: organizationId, is_active: true },
      select: { id: true },
    });

    if (!customer) {
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
      avatar_url: true,
      is_active: true,
      last_login_at: true,
      created_at: true,
      updated_at: true,
      customer: { select: { name: true } },
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
      return {
        data: data.map((item: any) => this.mapUserRelations(item)),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: selectFields,
    });

    return users.map((item: any) => this.mapUserRelations(item));
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
        avatar_url: true,
        customer_id: true,
        customer: { select: { id: true, name: true } },
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

    return this.mapUserRelations(user);
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
      if (dto.organization_id || dto.customer_id) {
        throw new BadRequestException('Un SUPER_ADMIN no puede asociarse a una organización o company');
      }
    } else {
      if (!dto.organization_id) {
        throw new BadRequestException('Los usuarios no SUPER_ADMIN deben pertenecer a una organización');
      }

      await this.ensureOrganizationExists(dto.organization_id);
    }

    if (dto.customer_id) {
      if (dto.role !== Role.CLIENT) {
        throw new BadRequestException('Solo un usuario con rol CLIENT puede asociarse a una company');
      }

      await this.ensureCustomerBelongsToOrganization(dto.customer_id, dto.organization_id!);
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
        customer_id: dto.customer_id || null,
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization_id: true,
        customer_id: true,
        is_active: true,
        created_at: true,
      }
    });

    return this.mapUserRelations(user);
  }

  async update(id: string, dto: UpdateUserDto, currentUser: { id: string; role: Role; orgId?: string }) {
    const user = await this.findOne(id, currentUser);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        avatar_url: true,
        is_active: true,
      }
    });

    return this.mapUserRelations(updatedUser);
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
