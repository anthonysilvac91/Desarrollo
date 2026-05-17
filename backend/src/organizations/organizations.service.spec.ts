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
    const prismaMock = { organization: { findUnique: jest.fn(), update: jest.fn() } };
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
});
