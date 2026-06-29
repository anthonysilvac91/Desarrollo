import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';
import { RealtimeService } from '../realtime/realtime.service';

function oc<T extends object>(obj: T): T {
  return expect.objectContaining(obj) as T;
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      owner: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: StorageService,
          useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() },
        },
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
        { provide: RealtimeService, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('buildStatsWhere() — purged_at', () => {
    it('getStats incluye purged_at: null en el where de conteo', async () => {
      const countSpy = jest.spyOn(prisma.user, 'count').mockResolvedValue(5);
      jest.spyOn(prisma.user, 'groupBy').mockResolvedValue([]);

      await service.getStats({
        id: 'admin-1',
        role: Role.ADMIN,
        orgId: 'org-1',
      });

      expect(countSpy).toHaveBeenCalledWith(
        oc({ where: oc({ purged_at: null }) }),
      );
    });

    it('getStats rechaza roles sin permiso (WORKER)', async () => {
      await expect(
        service.getStats({ id: 'worker-1', role: Role.WORKER, orgId: 'org-1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll() — paginación y purged_at', () => {
    it('incluye purged_at: null en todas las queries de listado', async () => {
      const findManySpy = jest.spyOn(prisma.user, 'findMany');
      const countSpy = jest.spyOn(prisma.user, 'count');

      await service.findAll(
        { page: 1, limit: 10 },
        { id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' },
      );

      expect(findManySpy).toHaveBeenCalledWith(
        oc({ where: oc({ purged_at: null }) }),
      );
      expect(countSpy).toHaveBeenCalledWith(
        oc({ where: oc({ purged_at: null }) }),
      );
    });

    it('siempre retorna formato paginado { data, meta } aunque no se envíen page ni limit', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(3);

      const rawResult: unknown = await service.findAll(
        {},
        { id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' },
      );
      const result = rawResult as {
        data: unknown[];
        meta: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      };

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toMatchObject({
        total: 3,
        page: 1,
        limit: 50,
        totalPages: 1,
      });
    });

    it('usa page=1 y limit=50 como defaults', async () => {
      const findManySpy = jest.spyOn(prisma.user, 'findMany');

      await service.findAll(
        {},
        { id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' },
      );

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('limit mayor a 100 se recorta a 100', async () => {
      const findManySpy = jest.spyOn(prisma.user, 'findMany');

      await service.findAll(
        { page: 1, limit: 999 },
        { id: 'admin-1', role: Role.ADMIN, orgId: 'org-1' },
      );

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('ADMIN queda scoped a su organization_id', async () => {
      const findManySpy = jest.spyOn(prisma.user, 'findMany');

      await service.findAll(
        {},
        { id: 'admin-1', role: Role.ADMIN, orgId: 'org-tenant-1' },
      );

      expect(findManySpy).toHaveBeenCalledWith(
        oc({ where: oc({ organization_id: 'org-tenant-1' }) }),
      );
    });

    it('WORKER solo ve usuarios con role EXTERNAL', async () => {
      const findManySpy = jest.spyOn(prisma.user, 'findMany');

      await service.findAll(
        {},
        { id: 'worker-1', role: Role.WORKER, orgId: 'org-1' },
      );

      expect(findManySpy).toHaveBeenCalledWith(
        oc({ where: oc({ role: Role.EXTERNAL }) }),
      );
    });
  });
});
