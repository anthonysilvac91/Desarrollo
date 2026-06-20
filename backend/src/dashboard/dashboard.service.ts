import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { DashboardStatsDto, RankingItemDto, EvolutionPointDto } from './dto/dashboard.dto';
import { StoredFilesService } from '../storage/stored-files.service';
import { isExternalRole } from '../common/compat/owner-role-compat';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private storedFilesService: StoredFilesService,
  ) {}

  async getStats(
    currentUser: { id: string; role: Role; orgId?: string; owner_id?: string },
    organizationId?: string,
    query?: { startDate?: string; endDate?: string }
  ): Promise<DashboardStatsDto> {
    const authorizedRoles: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.WORKER, Role.EXTERNAL];
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
    const isExternal = isExternalRole(currentUser.role);
    const currentOwnerId = currentUser.owner_id ?? null;

    if (isExternal && !currentOwnerId) {
      return this.emptyStats();
    }

    let statsWhere: any = { ...baseWhere };
    if (isWorker) {
      statsWhere.worker_id = currentUser.id;
    } else if (isExternal) {
      statsWhere.is_public = true;
      statsWhere.asset = { owner_id: currentOwnerId };
    }

    let selectedDateRange: { gte?: Date; lte?: Date } | undefined;

    // Filtros de fecha si se proveen
    if (query?.startDate || query?.endDate) {
      statsWhere.created_at = {};
      selectedDateRange = {};
      if (query.startDate) {
        selectedDateRange.gte = new Date(query.startDate);
        statsWhere.created_at.gte = selectedDateRange.gte;
      }
      if (query.endDate) {
        selectedDateRange.lte = new Date(query.endDate);
        statsWhere.created_at.lte = selectedDateRange.lte;
      }
    }

    const defaultEvolutionStart = new Date();
    defaultEvolutionStart.setDate(defaultEvolutionStart.getDate() - 6);
    defaultEvolutionStart.setHours(0, 0, 0, 0);
    const evolutionWhere = selectedDateRange
      ? statsWhere
      : {
          ...statsWhere,
          created_at: { gte: defaultEvolutionStart },
        };

    const [
      assetsCount,
      servicesCount,
      publicServices,
      privateServices,
      workersCount,
      ownersCount,
      adminsCount,
      recentServices,
      evolutionData,
      assetRanking,
      workerRanking,
      assetsServicedGroups,
      activeOperatorsGroups,
    ] = await Promise.all([
      // Assets Count
      isExternal
        ? this.prisma.asset.count({ where: { ...baseWhere, owner_id: currentOwnerId, is_active: true } })
        : this.prisma.asset.count({ where: { ...baseWhere, is_active: true } }),

      // Services Count
      this.prisma.service.count({ where: statsWhere }),
      this.prisma.service.count({ where: { ...statsWhere, is_public: true } }),
      this.prisma.service.count({ where: { ...statsWhere, is_public: false } }),

      // User Counts
      (isWorker || isExternal) ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.WORKER, is_active: true } }),
      (isWorker || isExternal) ? 0 : this.prisma.owner.count({ where: { ...baseWhere, is_active: true } }),
      (isWorker || isExternal) ? 0 : this.prisma.user.count({ where: { ...baseWhere, role: Role.ADMIN, is_active: true } }),

      // Recent Services
      this.prisma.service.findMany({
        where: statsWhere,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: { asset: { select: { name: true } }, worker: { select: { name: true } } },
      }),

      // Evolution (Last 7 days)
      this.prisma.service.findMany({
        where: evolutionWhere,
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
      (isWorker || isExternal) ? [] : this.prisma.service.groupBy({
        by: ['worker_id'],
        where: statsWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Assets Serviced (distinct assets with at least one service in period)
      this.prisma.service.groupBy({
        by: ['asset_id'],
        where: statsWhere,
      }),

      // Active Operators (distinct workers with services in period)
      (isWorker || isExternal) ? [] : this.prisma.service.groupBy({
        by: ['worker_id'],
        where: statsWhere,
      }),
    ]);

    // Procesar Evolución
    const evolution: EvolutionPointDto[] = this.processEvolution(evolutionData, selectedDateRange);

    // Procesar Rankings (Cargar nombres de IDs)
    const [topAssets, topWorkers] = await Promise.all([
      this.getRankingDetails(assetRanking, 'asset', 'asset_id', baseWhere.organization_id),
      this.getRankingDetails(workerRanking, 'user', 'worker_id', baseWhere.organization_id),
    ]);

    return {
      total_assets: assetsCount,
      total_services: servicesCount,
      total_workers: workersCount,
      total_owners: ownersCount,
      total_admins: adminsCount,
      public_services: publicServices,
      private_services: privateServices,
      assets_serviced: assetsServicedGroups.length,
      last_service: recentServices[0]?.created_at?.toISOString() ?? null,
      active_operators: activeOperatorsGroups.length,
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
      top_owners: [],
    };
  }

  private emptyStats(): DashboardStatsDto {
    return {
      total_assets: 0,
      total_services: 0,
      total_workers: 0,
      total_owners: 0,
      total_admins: 0,
      public_services: 0,
      private_services: 0,
      assets_serviced: 0,
      last_service: null,
      active_operators: 0,
      recent_services: [],
      evolution: this.processEvolution([]),
      top_assets: [],
      top_workers: [],
      top_owners: [],
    };
  }

  private processEvolution(data: any[], range?: { gte?: Date; lte?: Date }): EvolutionPointDto[] {
    const end = range?.lte ? new Date(range.lte) : new Date();
    const start = range?.gte ? new Date(range.gte) : new Date(end);
    if (!range?.gte) start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const dayMs = 24 * 60 * 60 * 1000;
    const actualDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs) + 1);

    if (actualDays > 62) {
      const buckets: Array<{ year: number; month: number; key: string }> = [];
      for (
        let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        cursor <= end;
        cursor.setMonth(cursor.getMonth() + 1)
      ) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        buckets.push({ year, month, key: `${year}-${month}` });
      }

      const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));
      data.forEach((item) => {
        const createdAt = new Date(item.created_at);
        const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
        if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
      });

      return buckets.map((bucket) => ({
        name: `${bucket.month + 1}/${String(bucket.year).slice(-2)}`,
        value: counts.get(bucket.key) ?? 0,
      }));
    }

    const totalDays = actualDays;
    const last7Days = [...Array(totalDays)].map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });

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

  private async getRankingDetails(rankingData: any[], type: 'asset' | 'user', idKey: string, organizationId?: string): Promise<RankingItemDto[]> {
    if (!rankingData.length) return [];

    const ids = rankingData.map(r => r[idKey]);
    const items = type === 'asset'
      ? await this.prisma.asset.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : await this.prisma.user.findMany({
          where: {
            id: { in: ids },
            ...(organizationId ? { organization_id: organizationId } : {}),
          },
          select: { id: true, name: true, avatar_file_id: true },
        });

    return Promise.all(
      rankingData.map(async (r) => {
        const item = items.find(i => i.id === r[idKey]);
        const avatarUrl = await this.storedFilesService.resolveFileUrlForOrg((item as any)?.avatar_file_id, organizationId);

        return {
          id: r[idKey],
          name: item?.name || 'Desconocido',
          metric: r._count.id,
          avatar_url: avatarUrl ?? undefined,
        };
      })
    );
  }
}
