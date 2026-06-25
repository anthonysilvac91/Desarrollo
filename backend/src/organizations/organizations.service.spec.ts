import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: any;

  const orgMock = { id: 'org-1', name: 'Test Org', slug: 'test-org-abc123' };
  const subMock = { id: 'sub-1', organization_id: 'org-1', plan: 'DEMO' };

  beforeEach(async () => {
    const txMock = {
      organization: { create: jest.fn().mockResolvedValue(orgMock) },
      subscription: { create: jest.fn().mockResolvedValue(subMock) },
      organizationStorageUsage: { create: jest.fn().mockResolvedValue({}) },
    };

    const prismaMock = {
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((fn) => fn(txMock)),
      _txMock: txMock,
    };

    const storageMock = { uploadFile: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        {
          provide: StorageGovernanceService,
          useValue: {
            assertCanStore: jest.fn(),
            getOrganizationUsage: jest.fn(),
            reconcileOrganizationFiles: jest.fn(),
          },
        },
        {
          provide: StoredFilesService,
          useValue: {
            resolveFileUrl: jest.fn().mockResolvedValue(null),
            resolveFileUrlForOrg: jest.fn().mockResolvedValue(null),
            registerUploadedFile: jest.fn(),
            deleteStoredFileAndBlob: jest.fn(),
          },
        },
        {
          provide: SubscriptionsService,
          useValue: { createForOrganization: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(OrganizationsService);
    prisma = module.get(PrismaService);
  });

  it('Debería poder actualizar settings de la organización', async () => {
    jest
      .spyOn(prisma.organization, 'findUnique')
      .mockResolvedValue({ logo_file_id: null } as any);
    jest
      .spyOn(prisma.organization, 'update')
      .mockResolvedValue({ logo_file_id: null } as any);
    await service.updateSettings('org-1', {
      auto_publish_services: false,
      worker_edit_policy: 'ALWAYS_OPEN',
    });
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-1' },
        data: {
          auto_publish_services: false,
          worker_edit_policy: 'ALWAYS_OPEN',
        },
      }),
    );
  });

  it('create() usa $transaction para crear org, subscription y storageUsage', async () => {
    const result = await service.create({ name: 'Test Org' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ organization: orgMock });

    const tx = prisma._txMock;
    expect(tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Test Org' }),
      }),
    );
    expect(tx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organization_id: 'org-1',
          plan: 'DEMO',
          status: 'TRIALING',
          max_storage_gb: 1,
        }),
      }),
    );
    expect(tx.organizationStorageUsage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organization_id: 'org-1',
          ready_bytes: 0,
          reserved_bytes: 0,
        }),
      }),
    );
  });

  it('create() genera slug internamente', async () => {
    await service.create({ name: 'Test Org' });

    const tx = prisma._txMock;
    const callArg = tx.organization.create.mock.calls[0][0];
    expect(callArg.data.name).toBe('Test Org');
    expect(callArg.data.slug).toMatch(/^test-org-[a-z0-9]+$/);
  });

  it('dos Organizations con el mismo name no generan slug duplicado', async () => {
    const org2 = { id: 'org-2', name: 'Marina', slug: 'marina-bbb222' };
    const tx = prisma._txMock;
    tx.organization.create
      .mockResolvedValueOnce(orgMock)
      .mockResolvedValueOnce(org2);

    await service.create({ name: 'Marina' });
    await service.create({ name: 'Marina' });

    const [call1, call2] = tx.organization.create.mock.calls;
    expect(call1[0].data.slug).not.toBe(call2[0].data.slug);
  });
});
