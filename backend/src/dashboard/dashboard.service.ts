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
    // ADMIN, SUPER_ADMIN y WORKER pueden acceder
    const authorizedRoles: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.WORKER];
    if (!authorizedRoles.includes(currentUser.role)) {
      throw new ForbiddenException('No tienes permiso para acceder al dashboard');
    }

    const baseWhere: any = {};

    // Determinar el alcance del tenant
    if (currentUser.role === Role.SUPER_ADMIN) {
      if (organizationId) {
        baseWhere.organization_id = organizationId;
      }
    } else {
      baseWhere.organization_id = currentUser.orgId;
    }

    // Lógica específica para WORKER (Dashboard Operativo)
    const isWorker = currentUser.role === Role.WORKER;
    const workerStatsWhere = isWorker ? { ...baseWhere, worker_id: currentUser.id } : baseWhere;

    // Obtener configuración de la org para el conteo de assets si es worker
    let workerCanSeeAllAssets = true;
    if (isWorker && currentUser.orgId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: currentUser.orgId },
        select: { worker_restricted_access: true },
      });
      workerCanSeeAllAssets = !org?.worker_restricted_access;
    }

    // Ejecutar conteos en paralelo
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
      // Assets: si es worker restingido, solo los suyos. Si no, todos los de su org.
      isWorker && !workerCanSeeAllAssets
        ? this.prisma.workerAssetAccess.count({ where: { worker_id: currentUser.id } })
        : this.prisma.asset.count({ where: baseWhere }),

      // Services: si es worker, solo los suyos
      this.prisma.service.count({ where: workerStatsWhere }),
      this.prisma.service.count({ where: { ...workerStatsWhere, is_public: true } }),
      this.prisma.service.count({ where: { ...workerStatsWhere, is_public: false } }),

      // Conteos de staff: solo para ADMIN/SUPER_ADMIN
      isWorker ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.WORKER } }),
      isWorker ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.CLIENT } }),
      isWorker ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.ADMIN } }),

      // Servicios recientes: si es worker, solo los suyos
      this.prisma.service.findMany({
        where: workerStatsWhere,
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
