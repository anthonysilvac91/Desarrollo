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
      organization: { findUnique: jest.fn() },
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StoredFilesService, useValue: { resolveFileUrl: jest.fn() } },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('CLIENT sin company_id no recibe metricas del tenant', async () => {
    const result = await service.getStats({ id: 'client-1', role: Role.CLIENT, orgId: 'org-1' });

    expect(result.total_assets).toBe(0);
    expect(result.total_services).toBe(0);
    expect(prisma.asset.count).not.toHaveBeenCalled();
    expect(prisma.service.count).not.toHaveBeenCalled();
  });

  it('CLIENT con company_id queda filtrado por su company', async () => {
    jest.spyOn(prisma.asset, 'count').mockResolvedValue(2);
    jest.spyOn(prisma.service, 'count').mockResolvedValue(3);
    jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);

    await service.getStats({
      id: 'client-1',
      role: Role.CLIENT,
      orgId: 'org-1',
      company_id: 'company-1',
    });

    expect(prisma.asset.count).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', company_id: 'company-1' },
    });
    expect(prisma.service.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organization_id: 'org-1',
        is_public: true,
        asset: { company_id: 'company-1' },
      }),
    });
  });

  it('WORKER restringido cuenta solo assets asignados', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
      worker_restricted_access: true,
    } as any);
    jest.spyOn(prisma.asset, 'count').mockResolvedValue(1);
    jest.spyOn(prisma.service, 'count').mockResolvedValue(1);
    jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);

    await service.getStats({ id: 'worker-1', role: Role.WORKER, orgId: 'org-1' });

    expect(prisma.asset.count).toHaveBeenCalledWith({
      where: {
        organization_id: 'org-1',
        worker_access: { some: { worker_id: 'worker-1' } },
      },
    });
    expect(prisma.service.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organization_id: 'org-1',
        worker_id: 'worker-1',
        asset: { worker_access: { some: { worker_id: 'worker-1' } } },
      }),
    });
  });
});
