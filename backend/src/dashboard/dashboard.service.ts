import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import {
  DashboardStatsDto,
  RankingItemDto,
  EvolutionPointDto,
} from './dto/dashboard.dto';
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
    query?: { startDate?: string; endDate?: string },
  ): Promise<DashboardStatsDto> {
    const authorizedRoles: Role[] = [
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.WORKER,
      Role.EXTERNAL,
    ];
    if (!authorizedRoles.includes(currentUser.role)) {
      throw new ForbiddenException(
        'No tienes permiso para acceder al dashboard',
      );
    }

    const baseWhere: any = { deleted_at: null };
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

    let workerAccessFilter: Record<string, unknown> = {};
    if (isWorker) {
      const baseWhereTyped = baseWhere as Record<string, unknown>;
      const orgId = baseWhereTyped['organization_id'] as string | undefined;
      const workerId = (currentUser as { id: string }).id;
      if (orgId) {
        const org = await this.prisma.organization.findUnique({
          where: { id: orgId },
          select: { worker_restricted_access: true },
        });
        if (org?.worker_restricted_access) {
          workerAccessFilter = {
            worker_access: {
              some: { worker_id: workerId, organization_id: orgId },
            },
          };
        }
      }
    }

    const statsWhere: any = { ...baseWhere };
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

    // Evolution date range (resolved once — shared by SQL query and label generation)
    const { start: evolutionStart, end: evolutionEnd } =
      this.resolveEvolutionDates(selectedDateRange);
    const evolutionMode = this.getEvolutionMode(evolutionStart, evolutionEnd);

    const [
      assetsCount,
      servicesCount,
      publicPrivateCounts,
      workersCount,
      ownersCount,
      adminsCount,
      recentServices,
      evolutionCounts,
      assetRanking,
      workerRanking,
      distinctCounts,
    ] = await Promise.all([
      // Assets Count
      isExternal
        ? this.prisma.asset.count({
            where: { ...baseWhere, owner_id: currentOwnerId, is_active: true },
          })
        : this.prisma.asset.count({
            where: { ...baseWhere, is_active: true, ...workerAccessFilter },
          }),

      // Services Count (total)
      this.prisma.service.count({ where: statsWhere }),

      // Public / Private counts — single groupBy instead of two count() calls
      this.prisma.service.groupBy({
        by: ['is_public'],
        where: statsWhere,
        _count: { id: true },
      }),

      // User Counts
      isWorker || isExternal
        ? 0
        : this.prisma.user.count({
            where: { ...baseWhere, role: Role.WORKER, is_active: true },
          }),
      isWorker || isExternal
        ? 0
        : this.prisma.owner.count({ where: { ...baseWhere, is_active: true } }),
      isWorker || isExternal
        ? 0
        : this.prisma.user.count({
            where: { ...baseWhere, role: Role.ADMIN, is_active: true },
          }),

      // Recent Services
      this.prisma.service.findMany({
        where: statsWhere,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          asset: { select: { name: true } },
          worker: { select: { name: true } },
        },
      }),

      // Evolution — GROUP BY in SQL; returns only M grouped rows, not N raw rows
      this.getEvolutionCountsRaw({
        organizationId: baseWhere.organization_id,
        workerId: isWorker ? currentUser.id : undefined,
        ownerId: isExternal ? (currentOwnerId ?? undefined) : undefined,
        isPublic: isExternal ? true : undefined,
        startDate: evolutionStart,
        endDate: evolutionEnd,
        mode: evolutionMode,
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
      isWorker || isExternal
        ? []
        : this.prisma.service.groupBy({
            by: ['worker_id'],
            where: statsWhere,
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5,
          }),

      // Assets serviced + active operators — COUNT DISTINCT in one SQL round-trip
      this.getDistinctCountsRaw({
        organizationId: baseWhere.organization_id,
        workerId: isWorker ? currentUser.id : undefined,
        ownerId: isExternal ? (currentOwnerId ?? undefined) : undefined,
        isPublic: isExternal ? true : undefined,
        includeOperators: !isWorker && !isExternal,
        createdAt: statsWhere.created_at,
      }),
    ]);

    const publicServices =
      publicPrivateCounts.find((g) => g.is_public === true)?._count?.id ?? 0;
    const privateServices =
      publicPrivateCounts.find((g) => g.is_public === false)?._count?.id ?? 0;

    const evolution: EvolutionPointDto[] = this.processEvolution(
      evolutionCounts,
      selectedDateRange,
    );

    // Procesar Rankings (Cargar nombres de IDs)
    const [topAssets, topWorkers] = await Promise.all([
      this.getRankingDetails(
        assetRanking,
        'asset',
        'asset_id',
        baseWhere.organization_id,
      ),
      this.getRankingDetails(
        workerRanking,
        'user',
        'worker_id',
        baseWhere.organization_id,
      ),
    ]);

    return {
      total_assets: assetsCount,
      total_services: servicesCount,
      total_workers: workersCount,
      total_owners: ownersCount,
      total_admins: adminsCount,
      public_services: publicServices,
      private_services: privateServices,
      assets_serviced: distinctCounts.assetsServiced,
      last_service: recentServices[0]?.created_at?.toISOString() ?? null,
      active_operators: distinctCounts.activeOperators,
      recent_services: recentServices.map((s) => ({
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
      evolution: this.processEvolution(new Map()),
      top_assets: [],
      top_workers: [],
      top_owners: [],
    };
  }

  private resolveEvolutionDates(range?: { gte?: Date; lte?: Date }): {
    start: Date;
    end: Date;
  } {
    const end = range?.lte ? new Date(range.lte) : new Date();
    const start = range?.gte ? new Date(range.gte) : new Date(end);
    if (!range?.gte) start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private getEvolutionMode(start: Date, end: Date): 'daily' | 'monthly' {
    const dayMs = 24 * 60 * 60 * 1000;
    // start is midnight, end is 23:59:59.999 → diff = (N-1).999 days → floor + 1 = N
    const actualDays = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / dayMs) + 1,
    );
    return actualDays > 62 ? 'monthly' : 'daily';
  }

  private async getEvolutionCountsRaw(params: {
    organizationId?: string;
    workerId?: string;
    ownerId?: string;
    isPublic?: boolean;
    startDate: Date;
    endDate: Date;
    mode: 'daily' | 'monthly';
  }): Promise<Map<string, number>> {
    const { organizationId, workerId, ownerId, isPublic, startDate, endDate, mode } =
      params;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`"deleted_at" IS NULL`,
      Prisma.sql`"purged_at" IS NULL`,
      Prisma.sql`"created_at" >= ${startDate}`,
      Prisma.sql`"created_at" <= ${endDate}`,
    ];
    if (organizationId)
      conditions.push(Prisma.sql`"organization_id" = ${organizationId}`);
    if (workerId) conditions.push(Prisma.sql`"worker_id" = ${workerId}`);
    if (isPublic !== undefined)
      conditions.push(Prisma.sql`"is_public" = ${isPublic}`);
    if (ownerId)
      conditions.push(
        Prisma.sql`"asset_id" IN (SELECT id FROM "Asset" WHERE "owner_id" = ${ownerId} AND "deleted_at" IS NULL AND "purged_at" IS NULL)`,
      );

    const whereClause = Prisma.join(conditions, ' AND ');
    // fmt is a hardcoded constant — not user-supplied, safe for Prisma.raw
    const fmt = Prisma.raw(
      mode === 'monthly' ? `'YYYY-MM'` : `'YYYY-MM-DD'`,
    );

    const rows = await this.prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT
        to_char("created_at" AT TIME ZONE 'UTC', ${fmt}) AS day,
        COUNT(*) AS count
      FROM "Service"
      WHERE ${whereClause}
      GROUP BY day
      ORDER BY day ASC
    `;

    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.day, Number(row.count));
    }
    return map;
  }

  private async getDistinctCountsRaw(params: {
    organizationId?: string;
    workerId?: string;
    ownerId?: string;
    isPublic?: boolean;
    includeOperators: boolean;
    createdAt?: { gte?: Date; lte?: Date };
  }): Promise<{ assetsServiced: number; activeOperators: number }> {
    const { organizationId, workerId, ownerId, isPublic, includeOperators, createdAt } =
      params;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`"deleted_at" IS NULL`,
      Prisma.sql`"purged_at" IS NULL`,
    ];
    if (organizationId)
      conditions.push(Prisma.sql`"organization_id" = ${organizationId}`);
    if (workerId) conditions.push(Prisma.sql`"worker_id" = ${workerId}`);
    if (isPublic !== undefined)
      conditions.push(Prisma.sql`"is_public" = ${isPublic}`);
    if (ownerId)
      conditions.push(
        Prisma.sql`"asset_id" IN (SELECT id FROM "Asset" WHERE "owner_id" = ${ownerId} AND "deleted_at" IS NULL AND "purged_at" IS NULL)`,
      );
    if (createdAt?.gte) conditions.push(Prisma.sql`"created_at" >= ${createdAt.gte}`);
    if (createdAt?.lte) conditions.push(Prisma.sql`"created_at" <= ${createdAt.lte}`);

    const whereClause = Prisma.join(conditions, ' AND ');
    // operatorsExpr is a hardcoded SQL fragment — not user-supplied, safe for Prisma.raw
    const operatorsExpr = includeOperators
      ? Prisma.raw('COUNT(DISTINCT "worker_id")')
      : Prisma.raw('0::bigint');

    const rows = await this.prisma.$queryRaw<
      { assets_serviced: bigint; active_operators: bigint }[]
    >`
      SELECT
        COUNT(DISTINCT "asset_id") AS assets_serviced,
        ${operatorsExpr} AS active_operators
      FROM "Service"
      WHERE ${whereClause}
    `;

    return {
      assetsServiced: Number(rows[0]?.assets_serviced ?? 0n),
      activeOperators: Number(rows[0]?.active_operators ?? 0n),
    };
  }

  private processEvolution(
    countsByKey: Map<string, number>,
    range?: { gte?: Date; lte?: Date },
  ): EvolutionPointDto[] {
    const { start, end } = this.resolveEvolutionDates(range);

    if (this.getEvolutionMode(start, end) === 'monthly') {
      // Monthly buckets — SQL keys are 'YYYY-MM' (1-based, zero-padded)
      const buckets: Array<{ year: number; month: number; key: string }> = [];
      for (
        let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        cursor <= end;
        cursor.setMonth(cursor.getMonth() + 1)
      ) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth(); // 0-based for label
        const mm = String(month + 1).padStart(2, '0'); // matches to_char 'YYYY-MM'
        buckets.push({ year, month, key: `${year}-${mm}` });
      }
      return buckets.map((bucket) => ({
        name: `${bucket.month + 1}/${String(bucket.year).slice(-2)}`,
        value: countsByKey.get(bucket.key) ?? 0,
      }));
    }

    // Daily buckets — SQL keys are 'YYYY-MM-DD' (UTC)
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / dayMs) + 1,
    );
    const days = [...Array(totalDays)].map((_, i) => {
      const d = new Date(start.getTime() + i * dayMs);
      return d.toISOString().split('T')[0]; // UTC date string
    });

    const daysMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days.map((day) => {
      const date = new Date(day + 'T00:00:00Z');
      return {
        name: `${daysMap[date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`,
        value: countsByKey.get(day) ?? 0,
      };
    });
  }

  private async getRankingDetails(
    rankingData: any[],
    type: 'asset' | 'user',
    idKey: string,
    organizationId?: string,
  ): Promise<RankingItemDto[]> {
    if (!rankingData.length) return [];

    const ids = rankingData.map((r) => r[idKey]);
    const items =
      type === 'asset'
        ? await this.prisma.asset.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : await this.prisma.user.findMany({
            where: {
              id: { in: ids },
              ...(organizationId ? { organization_id: organizationId } : {}),
            },
            select: { id: true, name: true, avatar_file_id: true },
          });

    const avatarFileIds = items.map((i) => (i as any).avatar_file_id);
    const urlMap = await this.storedFilesService.resolveFileUrlsForOrg(
      avatarFileIds,
      organizationId,
    );

    return rankingData.map((r) => {
      const item = items.find((i) => i.id === r[idKey]);
      const avatarFileId = (item as any)?.avatar_file_id;
      return {
        id: r[idKey],
        name: item?.name || 'Desconocido',
        metric: r._count.id,
        avatar_url: (avatarFileId ? urlMap.get(avatarFileId) : null) ?? undefined,
      };
    });
  }
}
