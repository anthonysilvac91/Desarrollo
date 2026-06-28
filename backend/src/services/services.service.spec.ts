import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { processUploadedImage } from '../common/files/image-processing';
import { validateImageFile } from '../common/files/image-validation';

jest.mock('../common/files/image-validation', () => ({
  validateImageFile: jest.fn(() => ({
    mime: 'image/png',
    extension: '.png',
    width: 4000,
    height: 3000,
    pixels: 12_000_000,
  })),
}));

jest.mock('../common/files/image-processing', () => ({
  processUploadedImage: jest.fn(async (file: Express.Multer.File) => {
    file.buffer = Buffer.from('processed-webp');
    file.size = file.buffer.length;
    file.mimetype = 'image/webp';
    return file;
  }),
}));

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: PrismaService;
  let storageService: { uploadFile: jest.Mock; deleteFile: jest.Mock };
  let storageGovernance: { assertCanStore: jest.Mock };
  let storedFilesService: {
    resolveFileUrl: jest.Mock;
    resolveFileUrlForOrg: jest.Mock;
    resolveFileUrlsForOrg: jest.Mock;
    registerUploadedFile: jest.Mock;
    deleteStoredFileAndBlob: jest.Mock;
  };

  beforeEach(async () => {
    const prismaMock = {
      organization: { findUnique: jest.fn() },
      asset: { findFirst: jest.fn(), findMany: jest.fn() },
      user: { findMany: jest.fn() },
      service: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };
    storageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };
    storageGovernance = {
      assertCanStore: jest.fn(),
    };
    storedFilesService = {
      resolveFileUrl: jest.fn(),
      resolveFileUrlForOrg: jest.fn().mockResolvedValue(null),
      resolveFileUrlsForOrg: jest.fn().mockResolvedValue(new Map()),
      registerUploadedFile: jest.fn(),
      deleteStoredFileAndBlob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageService },
        { provide: StorageGovernanceService, useValue: storageGovernance },
        { provide: StoredFilesService, useValue: storedFilesService },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('is_public = true si auto_publish_services = true', async () => {
      jest
        .spyOn(prisma.asset, 'findFirst')
        .mockResolvedValue({ id: 'asset-1' } as any);
      jest
        .spyOn(prisma.organization, 'findUnique')
        .mockResolvedValue({ auto_publish_services: true } as any);
      (jest.spyOn(prisma.service, 'create') as unknown as jest.Mock).mockImplementation(
        (args: any) => Promise.resolve(args.data),
      );

      const result = await service.create(
        { asset_id: 'asset-1', title: 'Test' },
        { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
      );

      expect(result.is_public).toBe(true);
      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_public: true }),
        }),
      );
    });

    it('is_public = false si auto_publish_services = false', async () => {
      jest
        .spyOn(prisma.asset, 'findFirst')
        .mockResolvedValue({ id: 'asset-2' } as any);
      jest
        .spyOn(prisma.organization, 'findUnique')
        .mockResolvedValue({ auto_publish_services: false } as any);
      (jest.spyOn(prisma.service, 'create') as unknown as jest.Mock).mockImplementation(
        (args: any) => Promise.resolve(args.data),
      );

      const result = await service.create(
        { asset_id: 'asset-2', title: 'Test 2' },
        { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
      );

      expect(result.is_public).toBe(false);
    });

    it('SUPER_ADMIN: usa organization_id del asset, no user.orgId', async () => {
      jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue({
        id: 'asset-sa',
        organization_id: 'org-target',
      } as any);
      jest
        .spyOn(prisma.organization, 'findUnique')
        .mockResolvedValue({ auto_publish_services: false } as any);
      (jest.spyOn(prisma.service, 'create') as unknown as jest.Mock).mockImplementation(
        (args: any) => Promise.resolve(args.data),
      );

      const result = await service.create(
        { asset_id: 'asset-sa', title: 'SA Service' },
        { id: 'super-1', orgId: null, role: 'SUPER_ADMIN' },
      );

      expect(prisma.asset.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            organization_id: expect.anything(),
          }),
        }),
      );
      expect(prisma.organization.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-target' },
        }),
      );
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

    it('procesa adjuntos de servicio a WebP antes de subir y registra metadata final', async () => {
      const originalFile = {
        originalname: 'evidencia-original.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.alloc(5 * 1024 * 1024),
        size: 5 * 1024 * 1024,
      } as Express.Multer.File;

      jest
        .spyOn(prisma.asset, 'findFirst')
        .mockResolvedValue({ id: 'asset-1' } as any);
      jest
        .spyOn(prisma.organization, 'findUnique')
        .mockResolvedValue({ auto_publish_services: true } as any);
      storageService.uploadFile.mockResolvedValue(
        'private://bucket/org/org-1/services/service-1/attachments/file.webp',
      );
      storedFilesService.registerUploadedFile.mockResolvedValue({
        id: 'stored-file-1',
      });
      (jest.spyOn(prisma.service, 'create') as unknown as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({
          ...args.data,
          attachments: args.data.attachments.create,
        }),
      );

      await service.create(
        { asset_id: 'asset-1', title: 'Service con evidencia' },
        { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
        [originalFile],
      );

      expect(validateImageFile).toHaveBeenCalledWith(
        originalFile,
        expect.objectContaining({
          maxBytes: 10 * 1024 * 1024,
          maxWidth: 6000,
          maxHeight: 6000,
          maxPixels: 24 * 1024 * 1024,
        }),
      );
      expect(processUploadedImage).toHaveBeenCalledWith(originalFile, {
        maxWidth: 2000,
        maxHeight: 2000,
        format: 'webp',
        quality: 82,
      });
      expect(storageGovernance.assertCanStore).toHaveBeenCalledWith(
        'org-1',
        Buffer.from('processed-webp').length,
      );
      expect(storageService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          mimetype: 'image/webp',
          size: Buffer.from('processed-webp').length,
        }),
        expect.objectContaining({ visibility: 'private' }),
      );
      expect(storedFilesService.registerUploadedFile).toHaveBeenCalledWith(
        expect.objectContaining({
          originalName: 'evidencia-original.jpg',
          mimeType: 'image/webp',
          sizeBytes: Buffer.from('processed-webp').length,
        }),
      );
      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attachments: {
              create: [
                expect.objectContaining({
                  file_type: 'image/webp',
                  file_name: 'evidencia-original.jpg',
                  file_size_bytes: Buffer.from('processed-webp').length,
                }),
              ],
            },
          }),
        }),
      );
    });

    it('rechaza adjuntos si el total original excede el limite por servicio', async () => {
      const files = Array.from({ length: 5 }, (_, index) => ({
        originalname: `evidencia-${index}.jpg`,
        mimetype: 'image/jpeg',
        buffer: Buffer.alloc(9 * 1024 * 1024),
        size: 9 * 1024 * 1024,
      })) as Express.Multer.File[];

      jest
        .spyOn(prisma.asset, 'findFirst')
        .mockResolvedValue({ id: 'asset-1' } as any);
      jest
        .spyOn(prisma.organization, 'findUnique')
        .mockResolvedValue({ auto_publish_services: true } as any);

      await expect(
        service.create(
          { asset_id: 'asset-1', title: 'Service con demasiada evidencia' },
          { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
          files,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(validateImageFile).not.toHaveBeenCalled();
      expect(processUploadedImage).not.toHaveBeenCalled();
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('no-SUPER_ADMIN: filtra siempre por organization_id (tenant isolation)', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);

      await service.findAll(
        {},
        { id: 'worker-1', orgId: 'org-abc', role: 'WORKER' },
      );

      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization_id: 'org-abc',
            worker_id: 'worker-1',
          }),
        }),
      );
    });

    it('WORKER: no aplica filtro WorkerAssetAccess (MVP)', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);

      await service.findAll(
        {},
        { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
      );

      const call = (prisma.service.findMany as jest.Mock).mock.calls[0][0];
      expect(JSON.stringify(call.where)).not.toContain('worker_access');
    });

    it('WORKER: lista solo servicios creados por el usuario actual', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);

      await service.findAll(
        { worker_id: 'worker-2' },
        { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
      );

      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ worker_id: 'worker-1' }),
        }),
      );
    });

    it('EXTERNAL: filtra por is_public, status COMPLETED y owner_id del asset', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);

      await service.findAll(
        {},
        {
          id: 'ext-1',
          orgId: 'org-1',
          role: 'EXTERNAL',
          owner_id: 'owner-123',
        },
      );

      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_public: true,
            status: 'COMPLETED',
            asset: { owner_id: 'owner-123' },
          }),
        }),
      );
    });

    it('EXTERNAL sin owner_id retorna paginado vacío sin consultar DB', async () => {
      const result = await service.findAll(
        {},
        { id: 'ext-1', orgId: 'org-1', role: 'EXTERNAL' },
      ) as any;

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual([]);
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(0);
      expect(prisma.service.findMany).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN: no filtra por organization_id', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(0);

      await service.findAll(
        {},
        { id: 'super-1', orgId: null, role: 'SUPER_ADMIN' },
      );

      const call = (prisma.service.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).not.toHaveProperty('organization_id');
    });

    it('siempre retorna formato paginado { data, meta } aunque no se envíen page ni limit', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(12);

      const result = await service.findAll(
        {},
        { id: 'admin-1', orgId: 'org-1', role: 'ADMIN' },
      ) as any;

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toMatchObject({
        total: 12,
        page: 1,
        limit: 50,
        totalPages: 1,
      });
    });

    it('usa page=1 y limit=50 como defaults', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(0);

      await service.findAll(
        {},
        { id: 'admin-1', orgId: 'org-1', role: 'ADMIN' },
      );

      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('limit mayor a 100 se recorta a 100', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(0);

      await service.findAll(
        { page: 1, limit: 999 } as any,
        { id: 'admin-1', orgId: 'org-1', role: 'ADMIN' },
      );

      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('calcula correctamente skip en página 3 con limit 10', async () => {
      jest.spyOn(prisma.service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.service, 'count').mockResolvedValue(30);

      await service.findAll(
        { page: 3, limit: 10 } as any,
        { id: 'admin-1', orgId: 'org-1', role: 'ADMIN' },
      );

      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('getFilterOptions()', () => {
    it('retorna workers/assets con shape liviano', async () => {
      jest
        .spyOn(prisma.user, 'findMany')
        .mockResolvedValue([{ id: 'worker-1', name: 'Worker One' }] as any);
      jest
        .spyOn(prisma.asset, 'findMany')
        .mockResolvedValue([{ id: 'asset-1', name: 'Asset One' }] as any);

      const result = await service.getFilterOptions({
        id: 'admin-1',
        orgId: 'org-1',
        role: 'ADMIN',
      });

      expect(result).toEqual({
        workers: [{ id: 'worker-1', name: 'Worker One' }],
        assets: [{ id: 'asset-1', name: 'Asset One' }],
      });
      expect(result).not.toHaveProperty('attachments');
      expect(result).not.toHaveProperty('file_url');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, name: true },
        }),
      );
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, name: true },
        }),
      );
    });

    it('no-SUPER_ADMIN: respeta organization_id en servicios visibles', async () => {
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);

      await service.getFilterOptions({
        id: 'worker-1',
        orgId: 'org-abc',
        role: 'WORKER',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            services_created: {
              some: expect.objectContaining({
                organization_id: 'org-abc',
                worker_id: 'worker-1',
              }),
            },
          }),
        }),
      );
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            services: {
              some: expect.objectContaining({
                organization_id: 'org-abc',
                worker_id: 'worker-1',
              }),
            },
          }),
        }),
      );
    });

    it('EXTERNAL: aplica visibilidad publica y owner_id', async () => {
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);

      await service.getFilterOptions({
        id: 'ext-1',
        orgId: 'org-1',
        role: 'EXTERNAL',
        owner_id: 'owner-1',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            services_created: {
              some: expect.objectContaining({
                organization_id: 'org-1',
                is_public: true,
                status: 'COMPLETED',
                asset: { owner_id: 'owner-1' },
              }),
            },
          }),
        }),
      );
    });
  });

  describe('getStats()', () => {
    beforeEach(() => {
      jest.spyOn(prisma.service, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.service, 'groupBy').mockResolvedValue([]);
    });

    it('aplica filtros visibles de asset y worker en los KPIs', async () => {
      await service.getStats(
        { asset_id: 'asset-1', worker_id: 'worker-2' },
        { id: 'admin-1', orgId: 'org-1', role: 'ADMIN' },
      );

      expect(prisma.service.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          organization_id: 'org-1',
          asset_id: 'asset-1',
          worker_id: 'worker-2',
        }),
      });
      expect(prisma.service.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization_id: 'org-1',
            asset_id: 'asset-1',
            worker_id: 'worker-2',
          }),
        }),
      );
    });

    it('WORKER ignora worker_id de query y usa el usuario actual', async () => {
      await service.getStats(
        { worker_id: 'worker-2' },
        { id: 'worker-1', orgId: 'org-1', role: 'WORKER' },
      );

      expect(prisma.service.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          organization_id: 'org-1',
          worker_id: 'worker-1',
        }),
      });
    });

    it('Semana aplica rango de fecha en period_services', async () => {
      await service.getStats(
        { preset: 'Semana' },
        { id: 'admin-1', orgId: 'org-1', role: 'ADMIN' },
      );

      expect(prisma.service.count).toHaveBeenNthCalledWith(2, {
        where: expect.objectContaining({
          created_at: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      });
    });
  });

  describe('update()', () => {
    it('ADMIN puede actualizar un servicio y setea admin_intervened = true', async () => {
      jest
        .spyOn(prisma.service, 'findUnique')
        .mockResolvedValue({ id: 'svc-1', organization_id: 'org-1' } as any);
      jest.spyOn(prisma.service, 'update').mockResolvedValue({} as any);

      await service.update(
        'svc-1',
        { title: 'Nuevo', status: 'ARCHIVED' },
        'org-1',
      );

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Nuevo',
            status: 'ARCHIVED',
            admin_intervened: true,
          }),
        }),
      );
    });
  });
});
