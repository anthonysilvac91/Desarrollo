import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { role?: Role; organizationId?: string }, currentUser: { id: string; role: Role; orgId?: string }) {
    // Solo SUPER_ADMIN y ADMIN pueden listar usuarios
    if (currentUser.role !== Role.SUPER_ADMIN && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('No tienes permiso para gestionar usuarios');
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

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        organization_id: true,
        role: true,
        email: true,
        name: true,
        phone: true,
        avatar_url: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    return users;
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
        is_active: true,
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

    return user;
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
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization_id: true,
        is_active: true,
        created_at: true,
      }
    });

    return user;
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

    return updatedUser;
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
