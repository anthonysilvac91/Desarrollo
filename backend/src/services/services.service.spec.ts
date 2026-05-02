import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';

describe('ServicesService.create - Auto Publish Logic', () => {
  let service: ServicesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      organization: { findUnique: jest.fn() },
      asset: { findFirst: jest.fn() },
      workerAssetAccess: { findUnique: jest.fn() },
      service: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() } },
        { provide: StorageGovernanceService, useValue: { assertCanStore: jest.fn() } },
        { provide: StoredFilesService, useValue: { resolveFileUrl: jest.fn(), registerFile: jest.fn(), deleteStoredFileAndBlob: jest.fn() } },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('Deberia setear is_public = true si la Organization tiene auto_publish_services = true', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
      id: 'org-1',
      auto_publish_services: true,
      worker_restricted_access: false,
      worker_edit_policy: 'TIME_WINDOW',
    } as any);
    jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue({ id: 'asset-1' } as any);

    jest.spyOn(prisma.service, 'create').mockImplementation((args: any) => Promise.resolve(args.data));

    const result = await service.create(
      { asset_id: 'asset-1', title: 'Test Service', description: 'Desc' },
      { id: 'worker-1', orgId: 'org-1' }
    );

    expect(result.is_public).toBe(true);
    expect(prisma.service.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ is_public: true })
    }));
  });

  it('Deberia setear is_public = false si la Organization define visibilidad restringida', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
      id: 'org-1',
      auto_publish_services: false,
      worker_restricted_access: false,
    } as any);
    jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue({ id: 'asset-2' } as any);

    jest.spyOn(prisma.service, 'create').mockImplementation((args: any) => Promise.resolve(args.data));

    const result = await service.create(
      { asset_id: 'asset-2', title: 'Test Service 2' },
      { id: 'worker-1', orgId: 'org-1' }
    );

    expect(result.is_public).toBe(false);
  });

  describe('findAll - Role-based Scoping and Tenant Isolation', () => {
    it('Deberia forzar organization_id para cualquier rol (Aislamiento Multi-tenant)', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      await service.findAll({}, { id: 'worker-1', orgId: 'org-tenant-xx', role: 'WORKER' });
      expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-tenant-xx' })
      }));
    });

    it('Deberia inyectar is_public = true y status = COMPLETED obligatoriamente si es CLIENT', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      await service.findAll({}, { id: 'client-1', orgId: 'org-tenant-xx', role: 'CLIENT', company_id: 'cust-123' });
      expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-tenant-xx',
          is_public: true,
          status: 'COMPLETED',
          asset: { company_id: 'cust-123' }
        })
      }));
    });

    it('Un CLIENT no deberia ver servicios de otras companies aunque compartan Organizacion', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      const myCompanyId = 'empresa-a';

      await service.findAll({}, { id: 'user-a', orgId: 'org-1', role: 'CLIENT', company_id: myCompanyId });

      expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          asset: { company_id: myCompanyId }
        })
      }));
    });

    it('Un CLIENT sin company_id no debe ver servicios del tenant', async () => {
      const result = await service.findAll({}, { id: 'client-1', orgId: 'org-1', role: 'CLIENT' });

      expect(result).toEqual([]);
      expect(prisma.service.findMany).not.toHaveBeenCalled();
    });

    it('Un WORKER restringido solo lista servicios de assets asignados', async () => {
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
        worker_restricted_access: true,
      } as any);
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);

      await service.findAll({}, { id: 'worker-1', orgId: 'org-1', role: 'WORKER' });

      expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          asset: { worker_access: { some: { worker_id: 'worker-1' } } },
        }),
      }));
    });
  });

  describe('update (Admin flow)', () => {
    it('Deberia permitir al Admin actualizar un servicio y setear admin_intervened = true', async () => {
      jest.spyOn(prisma.service, 'findUnique').mockResolvedValue({ id: 'service-1', organization_id: 'org-1' } as any);
      jest.spyOn(prisma.service, 'update').mockResolvedValue({} as any);

      await service.update('service-1', { title: 'Nuevo', status: 'ARCHIVED' }, 'org-1');

      expect(prisma.service.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'service-1' },
        data: expect.objectContaining({ title: 'Nuevo', status: 'ARCHIVED', admin_intervened: true })
      }));
    });
  });

  describe('findOne - Worker restricted access', () => {
    it('Un WORKER restringido no puede ver servicios de assets no asignados', async () => {
      jest.spyOn(prisma.service, 'findUnique').mockResolvedValue({
        id: 'service-1',
        organization_id: 'org-1',
        is_public: true,
        asset: { id: 'asset-1', company_id: null },
      } as any);
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
        worker_restricted_access: true,
      } as any);
      jest.spyOn(prisma.workerAssetAccess, 'findUnique').mockResolvedValue(null);

      await expect(
        service.findOne('service-1', { id: 'worker-1', orgId: 'org-1', role: 'WORKER' }),
      ).rejects.toThrow('Service no encontrado o acceso denegado');
    });
  });
});
