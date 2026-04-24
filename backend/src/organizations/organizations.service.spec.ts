import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = { organization: { update: jest.fn() } };
    const storageMock = { uploadFile: jest.fn() };
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [ 
        OrganizationsService, 
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock }
      ],
    }).compile();

    service = module.get(OrganizationsService);
    prisma = module.get(PrismaService);
  });

  it('Debería poder actualizar settings de la organización', async () => {
    jest.spyOn(prisma.organization, 'update').mockResolvedValue({} as any);
    await service.updateSettings('org-1', { auto_publish_jobs: false, worker_edit_policy: 'ALWAYS_OPEN' });
    expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'org-1' },
      data: { auto_publish_jobs: false, worker_edit_policy: 'ALWAYS_OPEN' }
    }));
  });
});
