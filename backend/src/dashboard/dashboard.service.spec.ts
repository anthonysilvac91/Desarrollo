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
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
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

  it('la evolucion usa el rango de fecha seleccionado', async () => {
    jest.spyOn(prisma.asset, 'count').mockResolvedValue(5);
    jest.spyOn(prisma.service, 'count').mockResolvedValue(3);
    jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);

    await service.getStats(
      { id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' },
      undefined,
      {
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-10T23:59:59.999Z',
      },
    );

    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          created_at: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-10T23:59:59.999Z'),
          },
        }),
        select: { created_at: true },
      }),
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
});
