import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService tenant scoping', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      asset: { count: jest.fn() },
      service: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      owner: { count: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: StoredFilesService,
          useValue: {
            resolveFileUrl: jest.fn(),
            resolveFileUrlOrRef: jest.fn(),
            resolveFileUrlForOrg: jest.fn().mockResolvedValue(null),
            resolveFileUrlsForOrg: jest.fn().mockResolvedValue(new Map()),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);

    // Default mocks for $queryRaw — evolution returns [] (no data), distinct returns zeros
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  it('EXTERNAL sin owner_id no recibe metricas del tenant', async () => {
    const result = await service.getStats({
      id: 'client-1',
      role: Role.EXTERNAL,
      orgId: 'org-1',
    });

    expect(result.total_assets).toBe(0);
    expect(result.total_services).toBe(0);
    expect(prisma.asset.count).not.toHaveBeenCalled();
    expect(prisma.service.count).not.toHaveBeenCalled();
  });

  it('EXTERNAL con owner_id queda filtrado por su owner', async () => {
    jest.spyOn(prisma.asset, 'count').mockResolvedValue(2);
    jest.spyOn(prisma.service, 'count').mockResolvedValue(3);
    jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);

    await service.getStats({
      id: 'client-1',
      role: Role.EXTERNAL,
      orgId: 'org-1',
      owner_id: 'owner-1',
    });

    expect(prisma.asset.count).toHaveBeenCalledWith({
      where: {
        organization_id: 'org-1',
        owner_id: 'owner-1',
        is_active: true,
        deleted_at: null,
      },
    });
    expect(prisma.service.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organization_id: 'org-1',
        is_public: true,
        asset: { owner_id: 'owner-1' },
      }),
    });
  });

  it('WORKER ve todos los assets de su org sin filtro WorkerAssetAccess (MVP)', async () => {
    jest.spyOn(prisma.asset, 'count').mockResolvedValue(5);
    jest.spyOn(prisma.service, 'count').mockResolvedValue(3);
    jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);

    await service.getStats({
      id: 'worker-1',
      role: Role.WORKER,
      orgId: 'org-1',
    });

    expect(prisma.asset.count).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', is_active: true, deleted_at: null },
    });
    const assetCountCall = (prisma.asset.count as jest.Mock).mock.calls[0][0];
    expect(JSON.stringify(assetCountCall.where)).not.toContain('worker_access');
  });

  it('la evolucion usa el rango de fecha seleccionado — genera N puntos con valor 0 cuando no hay datos', async () => {
    jest.spyOn(prisma.asset, 'count').mockResolvedValue(5);
    jest.spyOn(prisma.service, 'count').mockResolvedValue(3);
    jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);
    // $queryRaw retorna [] (sin datos de evolución ni distinct counts)

    const result = await service.getStats(
      { id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' },
      undefined,
      {
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-10T23:59:59.999Z',
      },
    );

    // 10 días (1 al 10 de junio inclusive) — todos con valor 0 sin datos
    expect(result.evolution).toHaveLength(10);
    result.evolution.forEach((pt) => expect(pt.value).toBe(0));
    // No se hace findMany para evolución — todos los datos vienen de $queryRaw
    expect(prisma.service.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ select: { created_at: true } }),
    );
  });

  it('WORKER: las métricas de servicios se filtran por su worker_id (solo sus servicios)', async () => {
    jest.spyOn(prisma.asset, 'count').mockResolvedValue(5);
    jest.spyOn(prisma.service, 'count').mockResolvedValue(2);
    jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);

    await service.getStats({
      id: 'worker-1',
      role: Role.WORKER,
      orgId: 'org-1',
    });

    expect(prisma.service.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          worker_id: 'worker-1',
        }),
      }),
    );
  });

  it('ADMIN: total_owners cuenta owners activos, no usuarios EXTERNAL', async () => {
    jest.spyOn(prisma.asset, 'count').mockResolvedValue(5);
    jest.spyOn(prisma.service, 'count').mockResolvedValue(2);
    jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);
    jest.spyOn(prisma.user, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.owner, 'count').mockResolvedValue(4);

    const result = await service.getStats({
      id: 'admin-1',
      role: Role.ADMIN,
      orgId: 'org-1',
    });

    expect(result.total_owners).toBe(4);
    expect(prisma.owner.count).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', is_active: true, deleted_at: null },
    });
    expect(prisma.user.count).not.toHaveBeenCalledWith({
      where: { organization_id: 'org-1', role: Role.EXTERNAL },
    });
  });

  describe('evolution — SQL GROUP BY', () => {
    const baseSetup = () => {
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);
    };

    it('los días sin datos tienen value 0 (zero-fill correcto)', async () => {
      baseSetup();
      // Solo devuelve datos para el 5to día del rango
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ day: '2026-06-05', count: 7n }]) // evolution
        .mockResolvedValueOnce([]); // distinct counts

      const result = await service.getStats(
        { id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' },
        undefined,
        { startDate: '2026-06-01T00:00:00.000Z', endDate: '2026-06-07T23:59:59.999Z' },
      );

      expect(result.evolution).toHaveLength(7);
      const june5 = result.evolution.find((p) => p.name.includes('5/6'));
      expect(june5?.value).toBe(7);
      // Los otros 6 días deben ser 0
      const zeroDays = result.evolution.filter((p) => !p.name.includes('5/6'));
      zeroDays.forEach((p) => expect(p.value).toBe(0));
    });

    it('no llama a findMany con select:{created_at} — la evolución viene de $queryRaw', async () => {
      baseSetup();
      await service.getStats({ id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' });
      expect(prisma.service.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ select: { created_at: true } }),
      );
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('rango > 62 días produce buckets mensuales', async () => {
      baseSetup();
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ day: '2026-03', count: 5n }, { day: '2026-04', count: 10n }])
        .mockResolvedValueOnce([]);

      const result = await service.getStats(
        { id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' },
        undefined,
        { startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-06-30T23:59:59.999Z' },
      );

      // 6 meses = 6 puntos
      expect(result.evolution).toHaveLength(6);
      const march = result.evolution.find((p) => p.name.startsWith('3/'));
      const april = result.evolution.find((p) => p.name.startsWith('4/'));
      expect(march?.value).toBe(5);
      expect(april?.value).toBe(10);
    });
  });

  describe('assets_serviced y active_operators — COUNT DISTINCT via $queryRaw', () => {
    const baseSetup = () => {
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);
    };

    it('ADMIN: assets_serviced y active_operators reflejan el resultado de $queryRaw', async () => {
      baseSetup();
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([]) // evolution
        .mockResolvedValueOnce([{ assets_serviced: 12n, active_operators: 4n }]); // distinct

      const result = await service.getStats({ id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' });

      expect(result.assets_serviced).toBe(12);
      expect(result.active_operators).toBe(4);
    });

    it('WORKER: active_operators es siempre 0 (no incluye operadores de otros)', async () => {
      baseSetup();
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([]) // evolution
        .mockResolvedValueOnce([{ assets_serviced: 3n, active_operators: 0n }]);

      const result = await service.getStats({ id: 'worker-1', role: Role.WORKER, orgId: 'org-1' });

      expect(result.active_operators).toBe(0);
      expect(result.assets_serviced).toBe(3);
    });

    it('EXTERNAL: active_operators es siempre 0', async () => {
      baseSetup();
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([]) // evolution
        .mockResolvedValueOnce([{ assets_serviced: 2n, active_operators: 0n }]);

      const result = await service.getStats({
        id: 'client-1',
        role: Role.EXTERNAL,
        orgId: 'org-1',
        owner_id: 'owner-1',
      });

      expect(result.active_operators).toBe(0);
    });

    it('no usa groupBy de asset_id/worker_id sin take (patrón .length eliminado)', async () => {
      baseSetup();
      await service.getStats({ id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' });

      const groupByCalls = (prisma.service.groupBy as jest.Mock).mock.calls;
      // El groupBy de asset_id o worker_id sin take era el patrón N+1 para .length
      const legacyLengthCalls = groupByCalls.filter(
        (c) =>
          (c[0].by?.includes('asset_id') || c[0].by?.includes('worker_id')) &&
          !c[0].take,
      );
      expect(legacyLengthCalls).toHaveLength(0);
    });
  });

  describe('public_services y private_services — groupBy único', () => {
    const baseSetup = () => {
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    };

    it('extrae public y private de un único groupBy por is_public', async () => {
      baseSetup();
      jest.spyOn(prisma.service, 'groupBy').mockImplementation((args: any) => {
        // El groupBy con by:['is_public'] devuelve los conteos
        if (args?.by?.includes('is_public')) {
          return Promise.resolve([
            { is_public: true, _count: { id: 8 } },
            { is_public: false, _count: { id: 3 } },
          ]) as any;
        }
        return Promise.resolve([]) as any;
      });

      const result = await service.getStats({ id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' });

      expect(result.public_services).toBe(8);
      expect(result.private_services).toBe(3);
      // No se hacen dos count() separados para public/private
      const countCalls = (prisma.service.count as jest.Mock).mock.calls;
      const publicPrivateCounts = countCalls.filter(
        (c) => c[0]?.where?.is_public !== undefined,
      );
      expect(publicPrivateCounts).toHaveLength(0);
    });

    it('EXTERNAL: private_services es 0 (solo ve servicios públicos)', async () => {
      baseSetup();
      jest.spyOn(prisma.service, 'groupBy').mockImplementation((args: any) => {
        if (args?.by?.includes('is_public')) {
          // EXTERNAL statsWhere ya tiene is_public:true → solo un grupo
          return Promise.resolve([{ is_public: true, _count: { id: 5 } }]) as any;
        }
        return Promise.resolve([]) as any;
      });

      const result = await service.getStats({
        id: 'client-1',
        role: Role.EXTERNAL,
        orgId: 'org-1',
        owner_id: 'owner-1',
      });

      expect(result.public_services).toBe(5);
      expect(result.private_services).toBe(0);
    });
  });

  describe('SUPER_ADMIN tenant scoping', () => {
    const baseSetup = () => {
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);
      jest.spyOn(prisma.user, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.owner, 'count').mockResolvedValue(0);
    };

    it('SUPER_ADMIN con organizationId filtra por esa org', async () => {
      baseSetup();
      await service.getStats({ id: 'sa-1', role: Role.SUPER_ADMIN }, 'org-specific');

      expect(prisma.asset.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organization_id: 'org-specific' }) }),
      );
    });

    it('SUPER_ADMIN sin organizationId no filtra por org (ve todas)', async () => {
      baseSetup();
      await service.getStats({ id: 'sa-1', role: Role.SUPER_ADMIN });

      const assetCountArg = (prisma.asset.count as jest.Mock).mock.calls[0][0];
      expect(assetCountArg.where).not.toHaveProperty('organization_id');
    });
  });

  it('ADMIN: total_workers y total_admins cuentan solo usuarios activos', async () => {
    jest.spyOn(prisma.asset, 'count').mockResolvedValue(5);
    jest.spyOn(prisma.service, 'count').mockResolvedValue(2);
    jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);
    jest.spyOn(prisma.owner, 'count').mockResolvedValue(1);
    jest.spyOn(prisma.user, 'count').mockResolvedValue(1);

    await service.getStats({ id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' });

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        organization_id: 'org-1',
        role: Role.WORKER,
        is_active: true,
        deleted_at: null,
      },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        organization_id: 'org-1',
        role: Role.ADMIN,
        is_active: true,
        deleted_at: null,
      },
    });
  });

  describe('purged_at en raw SQL', () => {
    it('getEvolutionCountsRaw incluye purged_at IS NULL en la consulta', async () => {
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.getStats({
        id: 'admin-1',
        role: Role.ADMIN,
        orgId: 'org-1',
      });

      const rawCalls = (prisma.$queryRaw as jest.Mock).mock.calls;
      expect(rawCalls.length).toBeGreaterThan(0);

      const allSqlParts = rawCalls
        .flatMap((callArgs: any[]) => callArgs)
        .map((arg: any) =>
          Array.isArray(arg?.strings)
            ? arg.strings.join(' ')
            : String(arg ?? ''),
        )
        .join(' ');

      expect(allSqlParts).toMatch(/"purged_at" IS NULL/);
    });

    it('getDistinctCountsRaw incluye purged_at IS NULL en la consulta', async () => {
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(5);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(3);
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ assets_serviced: 0n, active_operators: 0n }]);

      await service.getStats({
        id: 'admin-1',
        role: Role.ADMIN,
        orgId: 'org-1',
      });

      const rawCalls = (prisma.$queryRaw as jest.Mock).mock.calls;
      const allSqlParts = rawCalls
        .flatMap((callArgs: any[]) => callArgs)
        .map((arg: any) =>
          Array.isArray(arg?.strings)
            ? arg.strings.join(' ')
            : String(arg ?? ''),
        )
        .join(' ');

      expect(allSqlParts).toMatch(/"purged_at" IS NULL/);
    });
  });
});
