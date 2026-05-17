import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      organization: { findUnique: jest.fn() },
      asset: { findFirst: jest.fn() },
      service: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() } },
        { provide: StorageGovernanceService, useValue: { assertCanStore: jest.fn() } },
        {
          provide: StoredFilesService,
          useValue: {
            resolveFileUrl: jest.fn(),
            registerUploadedFile: jest.fn(),
            deleteStoredFileAndBlob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create()', () => {
    it('is_public = true si auto_publish_services = true', async () => {
      jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue({ id: 'asset-1' } as any);
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({ auto_publish_services: true } as any);
      jest.spyOn(prisma.service, 'create').mockImplementation((args: any) => Promise.resolve(args.data));

      const result = await service.create(
        { asset_id: 'asset-1', title: 'Test' },
        { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
      );

      expect(result.is_public).toBe(true);
      expect(prisma.service.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ is_public: true }),
      }));
    });

    it('is_public = false si auto_publish_services = false', async () => {
      jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue({ id: 'asset-2' } as any);
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({ auto_publish_services: false } as any);
      jest.spyOn(prisma.service, 'create').mockImplementation((args: any) => Promise.resolve(args.data));

      const result = await service.create(
        { asset_id: 'asset-2', title: 'Test 2' },
        { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
      );

      expect(result.is_public).toBe(false);
    });

    it('SUPER_ADMIN: usa organization_id del asset, no user.orgId', async () => {
      jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue({
        id: 'asset-sa', organization_id: 'org-target',
      } as any);
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({ auto_publish_services: false } as any);
      jest.spyOn(prisma.service, 'create').mockImplementation((args: any) => Promise.resolve(args.data));

      const result = await service.create(
        { asset_id: 'asset-sa', title: 'SA Service' },
        { id: 'super-1', orgId: null, role: 'SUPER_ADMIN' },
      );

      expect(prisma.asset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.not.objectContaining({ organization_id: expect.anything() }),
      }));
      expect(prisma.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'org-target' },
      }));
      expect(result.organization_id).toBe('org-target');
    });

    it('SUPER_ADMIN: lanza BadRequestException si el asset no existe', async () => {
      jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue(null);

      await expect(
        service.create(
          { asset_id: 'no-existe', title: 'X' },
          { id: 'super-1', orgId: null, role: 'SUPER_ADMIN' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('WORKER: lanza BadRequestException si el asset no pertenece a su org', async () => {
      jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue(null);

      await expect(
        service.create(
          { asset_id: 'asset-otro', title: 'X' },
          { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll()', () => {
    it('no-SUPER_ADMIN: filtra siempre por organization_id (tenant isolation)', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);

      await service.findAll({}, { id: 'worker-1', orgId: 'org-abc', role: 'WORKER' });

      expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-abc' }),
      }));
    });

    it('WORKER: no aplica filtro WorkerAssetAccess (MVP)', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);

      await service.findAll({}, { id: 'worker-1', orgId: 'org-1', role: 'WORKER' });

      const call = (prisma.service.findMany as jest.Mock).mock.calls[0][0];
      expect(JSON.stringify(call.where)).not.toContain('worker_access');
    });

    it('EXTERNAL: filtra por is_public, status COMPLETED y owner_id del asset', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);

      await service.findAll(
        {},
        { id: 'ext-1', orgId: 'org-1', role: 'EXTERNAL', owner_id: 'owner-123' },
      );

      expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          is_public: true,
          status: 'COMPLETED',
          asset: { owner_id: 'owner-123' },
        }),
      }));
    });

    it('EXTERNAL sin owner_id retorna vacío sin consultar DB', async () => {
      const result = await service.findAll(
        {},
        { id: 'ext-1', orgId: 'org-1', role: 'EXTERNAL' },
      );

      expect(result).toEqual([]);
      expect(prisma.service.findMany).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN: no filtra por organization_id', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);

      await service.findAll({}, { id: 'super-1', orgId: null, role: 'SUPER_ADMIN' });

      const call = (prisma.service.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).not.toHaveProperty('organization_id');
    });
  });

  describe('update()', () => {
    it('ADMIN puede actualizar un servicio y setea admin_intervened = true', async () => {
      jest.spyOn(prisma.service, 'findUnique').mockResolvedValue({ id: 'svc-1', organization_id: 'org-1' } as any);
      jest.spyOn(prisma.service, 'update').mockResolvedValue({} as any);

      await service.update('svc-1', { title: 'Nuevo', status: 'ARCHIVED' }, 'org-1');

      expect(prisma.service.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ title: 'Nuevo', status: 'ARCHIVED', admin_intervened: true }),
      }));
    });
  });
});
