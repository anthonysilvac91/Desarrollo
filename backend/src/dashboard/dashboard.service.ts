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
    // ADMIN, SUPER_ADMIN, WORKER y CLIENT pueden acceder
    const authorizedRoles: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.WORKER, Role.CLIENT];
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

    // Lógicas específicas por rol
    const isWorker = currentUser.role === Role.WORKER;
    const isClient = currentUser.role === Role.CLIENT;

    let statsWhere: any = { ...baseWhere };
    if (isWorker) {
      statsWhere.worker_id = currentUser.id;
    } else if (isClient) {
      statsWhere.is_public = true;
      statsWhere.asset = {
        client_access: { some: { client_id: currentUser.id } }
      };
    }

    // Obtener configuración de la org para worker si aplica
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
      // Assets
      isClient
        ? this.prisma.clientAssetAccess.count({ where: { client_id: currentUser.id } })
        : (isWorker && !workerCanSeeAllAssets)
          ? this.prisma.workerAssetAccess.count({ where: { worker_id: currentUser.id } })
          : this.prisma.asset.count({ where: baseWhere }),

      // Services
      this.prisma.service.count({ where: statsWhere }),
      this.prisma.service.count({ where: { ...statsWhere, is_public: true } }),
      this.prisma.service.count({ where: { ...statsWhere, is_public: false } }),

      // Conteos de staff (solo para administrativos)
      (isWorker || isClient) ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.WORKER } }),
      (isWorker || isClient) ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.CLIENT } }),
      (isWorker || isClient) ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.ADMIN } }),

      // Servicios recientes
      this.prisma.service.findMany({
        where: statsWhere,
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
