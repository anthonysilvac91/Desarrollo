import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';

describe('AssetsService', () => {
  let service: AssetsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      asset: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      owner: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: { uploadFile: jest.fn() } },
        {
          provide: StorageGovernanceService,
          useValue: { assertCanStore: jest.fn() },
        },
        {
          provide: StoredFilesService,
          useValue: {
            resolveFileUrl: jest.fn().mockResolvedValue(null),
            resolveFileUrlForOrg: jest.fn().mockResolvedValue(null),
            resolveFileUrlsForOrg: jest.fn().mockResolvedValue(new Map()),
            registerUploadedFile: jest.fn(),
            deleteStoredFileAndBlob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create()', () => {
    it('WORKER: inyecta su propio orgId como organization_id del activo', async () => {
      const mockAsset = {
        id: 'asset-1',
        name: 'Lancha',
        organization_id: 'org-1',
        owner_id: 'owner-1',
      };
      jest
        .spyOn(prisma.owner, 'findFirst')
        .mockResolvedValue({ id: 'owner-1' } as any);
      jest.spyOn(prisma.asset, 'create').mockResolvedValue(mockAsset as any);
      jest
        .spyOn(prisma.asset, 'findUnique')
        .mockResolvedValue(mockAsset as any);

      const result = await service.create(
        { name: 'Lancha', owner_id: 'owner-1' },
        'org-1',
      );

      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_id: 'org-1',
            owner_id: 'owner-1',
          }),
        }),
      );
      expect(result).toHaveProperty('organization_id', 'org-1');
    });

    it('ADMIN: crea activo inyectando su propio orgId', async () => {
      const mockAsset = {
        id: 'asset-2',
        name: 'Velero',
        organization_id: 'org-admin',
        owner_id: 'owner-2',
      };
      jest
        .spyOn(prisma.owner, 'findFirst')
        .mockResolvedValue({ id: 'owner-2' } as any);
      jest.spyOn(prisma.asset, 'create').mockResolvedValue(mockAsset as any);
      jest
        .spyOn(prisma.asset, 'findUnique')
        .mockResolvedValue(mockAsset as any);

      const result = await service.create(
        { name: 'Velero', owner_id: 'owner-2' },
        'org-admin',
      );

      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organization_id: 'org-admin' }),
        }),
      );
      expect(result).toHaveProperty('organization_id', 'org-admin');
    });

    it('cualquier rol con orgId: rechaza si dtoOrgId difiere (cross-org bloqueado)', async () => {
      await expect(
        service.create(
          { name: 'Yacht', owner_id: 'owner-1', organization_id: 'org-otro' },
          'org-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('owner_id de otra organización se rechaza al crear activo', async () => {
      jest.spyOn(prisma.owner, 'findFirst').mockResolvedValue(null);

      await expect(
        service.create({ name: 'Barco', owner_id: 'owner-otra-org' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('SUPER_ADMIN: usa dtoOrgId cuando su orgId es null/undefined', async () => {
      const mockAsset = {
        id: 'asset-2',
        name: 'Moto',
        organization_id: 'org-x',
        owner_id: 'owner-2',
      };
      jest
        .spyOn(prisma.owner, 'findFirst')
        .mockResolvedValue({ id: 'owner-2' } as any);
      jest.spyOn(prisma.asset, 'create').mockResolvedValue(mockAsset as any);
      jest
        .spyOn(prisma.asset, 'findUnique')
        .mockResolvedValue(mockAsset as any);

      const result = await service.create(
        { name: 'Moto', owner_id: 'owner-2', organization_id: 'org-x' },
        undefined as any,
      );

      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organization_id: 'org-x' }),
        }),
      );
      expect(result).toHaveProperty('organization_id', 'org-x');
    });

    it('lanza BadRequestException si no se puede resolver un orgId', async () => {
      await expect(
        service.create(
          { name: 'Sin org', owner_id: 'owner-1' },
          undefined as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll()', () => {
    it('WORKER: no filtra por WorkerAssetAccess — ve todos los activos de su org', async () => {
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);

      await service.findAll({}, 'org-1', 'WORKER');

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            worker_access: expect.anything(),
          }),
        }),
      );
    });

    it('WORKER: filtra por organization_id de su tenant', async () => {
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);

      await service.findAll({}, 'org-tenant-1', 'WORKER');

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organization_id: 'org-tenant-1' }),
        }),
      );
    });

    it('EXTERNAL: solo ve activos de su owner', async () => {
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);

      await service.findAll({}, 'org-1', 'EXTERNAL', 'owner-abc');

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ owner_id: 'owner-abc' }),
        }),
      );
    });

    it('EXTERNAL sin owner_id retorna array vacío sin consultar DB', async () => {
      const result = await service.findAll({}, 'org-1', 'EXTERNAL', undefined);

      expect(result).toEqual([]);
      expect(prisma.asset.findMany).not.toHaveBeenCalled();
    });

    it('SUPER_ADMIN: no filtra por organization_id', async () => {
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);

      await service.findAll({}, null as any, 'SUPER_ADMIN');

      const call = (prisma.asset.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).not.toHaveProperty('organization_id');
    });

    it('siempre retorna formato paginado { data, meta } aunque no se envíen page ni limit', async () => {
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(7);

      const result = await service.findAll({}, 'org-1', 'ADMIN') as any;

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toMatchObject({
        total: 7,
        page: 1,
        limit: 50,
        totalPages: 1,
      });
    });

    it('usa page=1 y limit=50 como defaults cuando no se proveen', async () => {
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);

      await service.findAll({}, 'org-1', 'ADMIN');

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('limit mayor a 100 se recorta a 100', async () => {
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 500 }, 'org-1', 'ADMIN');

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('calcula correctamente skip en página 3 con limit 10', async () => {
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(30);

      await service.findAll({ page: 3, limit: 10 }, 'org-1', 'ADMIN');

      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('siempre ejecuta prisma.count en paralelo con findMany', async () => {
      jest.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.asset, 'count').mockResolvedValue(0);

      await service.findAll({}, 'org-1', 'ADMIN');

      expect(prisma.asset.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFilterOptions()', () => {
    it('retorna owners con shape liviano', async () => {
      jest
        .spyOn(prisma.owner, 'findMany')
        .mockResolvedValue([{ id: 'owner-1', name: 'Owner One' }] as any);

      const result = await service.getFilterOptions('org-1', 'ADMIN');

      expect(result).toEqual({
        owners: [{ id: 'owner-1', name: 'Owner One' }],
      });
      expect(result).not.toHaveProperty('assets');
      expect(result).not.toHaveProperty('thumbnail_url');
      expect(prisma.owner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, name: true },
        }),
      );
    });

    it('no-SUPER_ADMIN: respeta organization_id en activos visibles', async () => {
      jest.spyOn(prisma.owner, 'findMany').mockResolvedValue([]);

      await service.getFilterOptions('org-tenant-1', 'WORKER');

      expect(prisma.owner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assets: {
              some: expect.objectContaining({
                organization_id: 'org-tenant-1',
                is_active: true,
              }),
            },
          },
        }),
      );
    });

    it('EXTERNAL: limita owners al owner_id del usuario', async () => {
      jest.spyOn(prisma.owner, 'findMany').mockResolvedValue([]);

      await service.getFilterOptions('org-1', 'EXTERNAL', 'owner-abc');

      expect(prisma.owner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assets: {
              some: expect.objectContaining({
                organization_id: 'org-1',
                owner_id: 'owner-abc',
                is_active: true,
              }),
            },
          },
        }),
      );
    });
  });
});
