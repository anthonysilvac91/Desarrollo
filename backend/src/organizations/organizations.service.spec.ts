import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = { organization: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() } };
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
            registerUploadedFile: jest.fn(),
            deleteStoredFileAndBlob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrganizationsService);
    prisma = module.get(PrismaService);
  });

  it('Debería poder actualizar settings de la organización', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({ logo_file_id: null } as any);
    jest.spyOn(prisma.organization, 'update').mockResolvedValue({ logo_file_id: null } as any);
    await service.updateSettings('org-1', { auto_publish_jobs: false, worker_edit_policy: 'ALWAYS_OPEN' });
    expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'org-1' },
      data: { auto_publish_jobs: false, worker_edit_policy: 'ALWAYS_OPEN' }
    }));
  });

  it('create() no requiere slug — solo name', async () => {
    const org = { id: 'org-1', name: 'Test Org', slug: 'test-org-abc123' };
    jest.spyOn(prisma.organization, 'create').mockResolvedValue(org as any);

    const result = await service.create({ name: 'Test Org' });

    expect(result).toEqual({ organization: org });
    expect(result).not.toHaveProperty('initial_invitation_token');
  });

  it('create() genera slug internamente y llama create con name + slug técnico', async () => {
    const org = { id: 'org-1', name: 'Test Org', slug: 'test-org-abc123' };
    jest.spyOn(prisma.organization, 'create').mockResolvedValue(org as any);

    await service.create({ name: 'Test Org' });

    const callArg = (prisma.organization.create as jest.Mock).mock.calls[0][0];
    expect(callArg.data.name).toBe('Test Org');
    expect(callArg.data.slug).toMatch(/^test-org-[a-z0-9]+$/);
  });

  it('dos Organizations con el mismo name no generan slug duplicado', async () => {
    const org1 = { id: 'org-1', name: 'Marina', slug: 'marina-aaa111' };
    const org2 = { id: 'org-2', name: 'Marina', slug: 'marina-bbb222' };
    jest.spyOn(prisma.organization, 'create')
      .mockResolvedValueOnce(org1 as any)
      .mockResolvedValueOnce(org2 as any);

    await service.create({ name: 'Marina' });
    await service.create({ name: 'Marina' });

    const [call1, call2] = (prisma.organization.create as jest.Mock).mock.calls;
    expect(call1[0].data.slug).not.toBe(call2[0].data.slug);
  });
});
