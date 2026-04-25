import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { DashboardStatsDto, RankingItemDto, EvolutionPointDto } from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(
    currentUser: { id: string; role: Role; orgId?: string; customer_id?: string },
    organizationId?: string,
    query?: { startDate?: string; endDate?: string }
  ): Promise<DashboardStatsDto> {
    const authorizedRoles: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.WORKER, Role.CLIENT];
    if (!authorizedRoles.includes(currentUser.role)) {
      throw new ForbiddenException('No tienes permiso para acceder al dashboard');
    }

    const baseWhere: any = {};
    if (currentUser.role === Role.SUPER_ADMIN) {
      if (organizationId) {
        baseWhere.organization_id = organizationId;
      }
    } else {
      baseWhere.organization_id = currentUser.orgId;
    }

    const isWorker = currentUser.role === Role.WORKER;
    const isClient = currentUser.role === Role.CLIENT;

    let statsWhere: any = { ...baseWhere };
    if (isWorker) {
      statsWhere.worker_id = currentUser.id;
    } else if (isClient) {
      statsWhere.is_public = true;
      statsWhere.asset = { customer_id: currentUser.customer_id };
    }

    // Filtros de fecha si se proveen
    if (query?.startDate || query?.endDate) {
      statsWhere.created_at = {};
      if (query.startDate) statsWhere.created_at.gte = new Date(query.startDate);
      if (query.endDate) statsWhere.created_at.lte = new Date(query.endDate);
    }

    const [
      assetsCount,
      servicesCount,
      publicServices,
      privateServices,
      workersCount,
      clientsCount,
      adminsCount,
      recentServices,
      evolutionData,
      assetRanking,
      workerRanking
    ] = await Promise.all([
      // Assets Count
      isClient
        ? this.prisma.asset.count({ where: { ...baseWhere, customer_id: currentUser.customer_id } })
        : this.prisma.asset.count({ where: baseWhere }),

      // Services Count
      this.prisma.service.count({ where: statsWhere }),
      this.prisma.service.count({ where: { ...statsWhere, is_public: true } }),
      this.prisma.service.count({ where: { ...statsWhere, is_public: false } }),

      // User Counts
      (isWorker || isClient) ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.WORKER } }),
      (isWorker || isClient) ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.CLIENT } }),
      (isWorker || isClient) ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.ADMIN } }),

      // Recent Services
      this.prisma.service.findMany({
        where: statsWhere,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: { asset: { select: { name: true } }, worker: { select: { name: true } } },
      }),

      // Evolution (Last 7 days)
      this.prisma.service.findMany({
        where: { 
          ...statsWhere, 
          created_at: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) } 
        },
        select: { created_at: true },
        orderBy: { created_at: 'asc' }
      }),

      // Top Assets (Rankings)
      this.prisma.service.groupBy({
        by: ['asset_id'],
        where: statsWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Top Workers
      (isWorker || isClient) ? [] : this.prisma.service.groupBy({
        by: ['worker_id'],
        where: statsWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    // Procesar Evolución
    const evolution: EvolutionPointDto[] = this.processEvolution(evolutionData);

    // Procesar Rankings (Cargar nombres de IDs)
    const [topAssets, topWorkers] = await Promise.all([
      this.getRankingDetails(assetRanking, 'asset', 'asset_id'),
      this.getRankingDetails(workerRanking, 'user', 'worker_id'),
    ]);

    return {
      total_assets: assetsCount,
      total_services: servicesCount,
      total_workers: workersCount,
      total_clients: clientsCount,
      total_admins: adminsCount,
      public_services: publicServices,
      private_services: privateServices,
      recent_services: recentServices.map(s => ({
        id: s.id,
        title: s.title,
        created_at: s.created_at,
        asset_name: s.asset.name,
        worker_name: s.worker.name,
      })),
      evolution,
      top_assets: topAssets,
      top_workers: topWorkers,
      top_clients: [], // Por simplicidad en MVP, Clients ranking opcional
    };
  }

  private processEvolution(data: any[]): EvolutionPointDto[] {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const counts: Record<string, number> = {};
    last7Days.forEach(day => counts[day] = 0);
    
    data.forEach(item => {
      const day = item.created_at.toISOString().split('T')[0];
      if (counts[day] !== undefined) counts[day]++;
    });

    const daysMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return last7Days.map(day => {
      const date = new Date(day);
      return {
        name: `${daysMap[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`,
        value: counts[day]
      };
    });
  }

  private async getRankingDetails(rankingData: any[], type: 'asset' | 'user', idKey: string): Promise<RankingItemDto[]> {
    if (!rankingData.length) return [];
    
    const ids = rankingData.map(r => r[idKey]);
    const items = type === 'asset' 
      ? await this.prisma.asset.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, avatar_url: true } });

    return rankingData.map(r => {
      const item = items.find(i => i.id === r[idKey]);
      return {
        id: r[idKey],
        name: item?.name || 'Desconocido',
        metric: r._count.id,
        avatar_url: (item as any)?.avatar_url,
      };
    });
  }
}
