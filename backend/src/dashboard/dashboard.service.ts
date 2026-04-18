import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { DashboardStatsDto } from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(
    currentUser: { id: string; role: Role; orgId?: string },
    organizationId?: string
  ): Promise<DashboardStatsDto> {
    // Solo ADMIN y SUPER_ADMIN pueden acceder
    if (currentUser.role !== Role.ADMIN && currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('No tienes permiso para acceder al dashboard');
    }

    const whereClause: any = {};

    // Determinar el alcance del tenant
    if (currentUser.role === Role.SUPER_ADMIN) {
      // Si es SUPER_ADMIN y pasa orgId, filtramos por esa org. Si no, global.
      if (organizationId) {
        whereClause.organization_id = organizationId;
      }
    } else {
      // Si es ADMIN, forzado a su organización
      whereClause.organization_id = currentUser.orgId;
    }

    // Ejecutar conteos en paralelo para mejor performance
    const [
      assetsCount,
      servicesCount,
      publicServices,
      privateServices,
      workersCount,
      clientsCount,
      adminsCount,
      recentServices,
    ] = await Promise.all([
      this.prisma.asset.count({ where: whereClause }),
      this.prisma.service.count({ where: whereClause }),
      this.prisma.service.count({ where: { ...whereClause, is_public: true } }),
      this.prisma.service.count({ where: { ...whereClause, is_public: false } }),
      this.prisma.user.count({ where: { ...whereClause, role: Role.WORKER } }),
      this.prisma.user.count({ where: { ...whereClause, role: Role.CLIENT } }),
      this.prisma.user.count({ where: { ...whereClause, role: Role.ADMIN } }),
      this.prisma.service.findMany({
        where: whereClause,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          asset: { select: { name: true } },
          worker: { select: { name: true } },
        },
      }),
    ]);

    return {
      total_assets: assetsCount,
      total_services: servicesCount,
      total_workers: workersCount,
      total_clients: clientsCount,
      total_admins: adminsCount,
      public_services: publicServices,
      private_services: privateServices,
      recent_services: recentServices.map((s) => ({
        id: s.id,
        title: s.title,
        created_at: s.created_at,
        asset_name: s.asset.name,
        worker_name: s.worker.name,
      })),
    };
  }
}
