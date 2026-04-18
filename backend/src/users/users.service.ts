import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

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
}
