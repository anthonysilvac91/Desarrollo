import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { EmailService } from '../email/email.service';

describe('ServicesService.getStats regression', () => {
  const prismaMock = {
    service: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const storageService = {} as unknown as StorageService;
  const storageGovernance = {} as unknown as StorageGovernanceService;
  const storedFilesService = {} as unknown as StoredFilesService;
  const emailService = {} as unknown as EmailService;

  let service: ServicesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.service.count.mockResolvedValueOnce(12).mockResolvedValueOnce(5);
    prismaMock.service.groupBy
      .mockResolvedValueOnce([{ _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ _count: { _all: 2 } }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageService },
        { provide: StorageGovernanceService, useValue: storageGovernance },
        { provide: StoredFilesService, useValue: storedFilesService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get(ServicesService);
  });

  it('usa groupBy sin worker_id not null y conserva filtros base', async () => {
    const result = await service.getStats(
      { asset_id: 'asset-1', worker_id: 'worker-2' },
      { id: 'admin-1', orgId: 'org-1', role: 'ADMIN' },
    );

    expect(result).toEqual({
      total_services: 12,
      period_services: 5,
      assets_serviced: 1,
      active_operators: 1,
    });

    expect(prismaMock.service.count).toHaveBeenNthCalledWith(1, {
      where: {
        deleted_at: null,
        purged_at: null,
        organization_id: 'org-1',
        asset_id: 'asset-1',
        worker_id: 'worker-2',
      },
    });
    expect(prismaMock.service.groupBy).toHaveBeenNthCalledWith(1, {
      by: ['asset_id'],
      where: {
        deleted_at: null,
        purged_at: null,
        organization_id: 'org-1',
        asset_id: 'asset-1',
        worker_id: 'worker-2',
      },
    });
    expect(prismaMock.service.groupBy).toHaveBeenNthCalledWith(2, {
      by: ['worker_id'],
      where: {
        deleted_at: null,
        purged_at: null,
        organization_id: 'org-1',
        asset_id: 'asset-1',
        worker_id: 'worker-2',
      },
    });
    expect(JSON.stringify(prismaMock.service.groupBy.mock.calls)).not.toContain(
      '"not":null',
    );
  });

  it('WORKER mantiene el filtro por su propio usuario', async () => {
    await service.getStats(
      { worker_id: 'worker-2' },
      { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
    );

    expect(prismaMock.service.count).toHaveBeenCalledWith({
      where: {
        deleted_at: null,
        purged_at: null,
        organization_id: 'org-1',
        worker_id: 'worker-1',
      },
    });
  });
});
