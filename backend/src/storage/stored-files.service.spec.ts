import { Test, TestingModule } from '@nestjs/testing';
import { StoredFileKind } from '@prisma/client';
import { StoredFilesService } from './stored-files.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

describe('StoredFilesService', () => {
  let service: StoredFilesService;
  let prisma: {
    storedFile: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    organizationStorageUsage: {
      upsert: jest.Mock;
    };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let storageService: {
    deleteFile: jest.Mock;
    resolveFileUrl: jest.Mock;
    canHandleFileRef: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      storedFile: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      organizationStorageUsage: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
      $executeRaw: jest.fn(),
    };
    storageService = {
      deleteFile: jest.fn(),
      resolveFileUrl: jest.fn(),
      canHandleFileRef: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoredFilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<StoredFilesService>(StoredFilesService);
  });

  describe('registerFile — dual-write', () => {
    it('escribe entity_type y entity_id', async () => {
      prisma.storedFile.create.mockResolvedValue({ id: 'sf-1' });

      await service.registerFile({
        organizationId: 'org-1',
        storageRef: 'private://org-1/thumb.jpg',
        kind: StoredFileKind.ASSET_THUMBNAIL,
        visibility: 'private',
        entityType: 'ASSET',
        entityId: 'asset-1',
      });

      expect(prisma.storedFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity_type: 'ASSET',
            entity_id: 'asset-1',
          }),
        }),
      );
    });

    it('escribe entity_type OWNER para logos de owner', async () => {
      prisma.storedFile.create.mockResolvedValue({ id: 'sf-2' });

      await service.registerFile({
        organizationId: 'org-1',
        storageRef: 'private://org-1/logo.jpg',
        kind: StoredFileKind.OWNER_LOGO,
        visibility: 'private',
        entityType: 'OWNER',
        entityId: 'owner-1',
      });

      expect(prisma.storedFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity_type: 'OWNER',
            entity_id: 'owner-1',
          }),
        }),
      );
    });

    it('entity_id refleja el entityId proporcionado', async () => {
      prisma.storedFile.create.mockResolvedValue({ id: 'sf-3' });

      await service.registerFile({
        organizationId: 'org-1',
        storageRef: 'private://org-1/org-logo.jpg',
        kind: StoredFileKind.ORG_LOGO,
        visibility: 'public',
        entityType: 'ORGANIZATION',
        entityId: 'org-1',
      });

      const callData = prisma.storedFile.create.mock.calls[0][0].data;
      expect(callData.entity_id).toBe('org-1');
    });
  });

  describe('resolveFileUrlsForOrg — batch', () => {
    const ORG = 'org-1';

    it('ejecuta una sola findMany para múltiples IDs', async () => {
      prisma.storedFile.findMany.mockResolvedValue([
        { id: 'sf-1', storage_ref: 'private://org-1/a.jpg' },
        { id: 'sf-2', storage_ref: 'private://org-1/b.jpg' },
      ]);
      storageService.resolveFileUrl.mockImplementation(
        (ref: string) => Promise.resolve(`https://cdn/${ref}`),
      );

      const result = await service.resolveFileUrlsForOrg(
        ['sf-1', 'sf-2'],
        ORG,
      );

      expect(prisma.storedFile.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.storedFile.findUnique).not.toHaveBeenCalled();
      expect(result.get('sf-1')).toContain('a.jpg');
      expect(result.get('sf-2')).toContain('b.jpg');
    });

    it('deduplica IDs repetidos antes de la consulta', async () => {
      prisma.storedFile.findMany.mockResolvedValue([
        { id: 'sf-1', storage_ref: 'private://org-1/a.jpg' },
      ]);
      storageService.resolveFileUrl.mockResolvedValue('https://cdn/a.jpg');

      await service.resolveFileUrlsForOrg(['sf-1', 'sf-1', 'sf-1'], ORG);

      const call = prisma.storedFile.findMany.mock.calls[0][0];
      expect(call.where.id.in).toEqual(['sf-1']);
    });

    it('retorna Map vacío cuando no hay IDs válidos', async () => {
      const result = await service.resolveFileUrlsForOrg(
        [null, undefined, ''],
        ORG,
      );
      expect(result.size).toBe(0);
      expect(prisma.storedFile.findMany).not.toHaveBeenCalled();
    });

    it('retorna Map vacío cuando organizationId es null', async () => {
      const result = await service.resolveFileUrlsForOrg(['sf-1'], null);
      expect(result.size).toBe(0);
      expect(prisma.storedFile.findMany).not.toHaveBeenCalled();
    });

    it('IDs inexistentes no aparecen en el Map (caller recibe null vía ??)', async () => {
      prisma.storedFile.findMany.mockResolvedValue([]);
      storageService.resolveFileUrl.mockResolvedValue(null);

      const result = await service.resolveFileUrlsForOrg(['sf-ghost'], ORG);
      expect(result.has('sf-ghost')).toBe(false);
      expect(result.get('sf-ghost') ?? null).toBeNull();
    });

    it('archivos de otra organización son filtrados por la query y no aparecen', async () => {
      // findMany filtra por organization_id; devuelve vacío para org incorrecta
      prisma.storedFile.findMany.mockResolvedValue([]);

      const result = await service.resolveFileUrlsForOrg(
        ['sf-other-org'],
        'org-correct',
      );
      expect(result.has('sf-other-org')).toBe(false);

      const queryArg = prisma.storedFile.findMany.mock.calls[0][0];
      expect(queryArg.where.organization_id).toBe('org-correct');
    });

    it('filtra organization_id dentro de la query, no después', async () => {
      prisma.storedFile.findMany.mockResolvedValue([]);
      await service.resolveFileUrlsForOrg(['sf-1'], 'org-abc');

      const queryWhere = prisma.storedFile.findMany.mock.calls[0][0].where;
      expect(queryWhere).toMatchObject({
        id: { in: ['sf-1'] },
        organization_id: 'org-abc',
      });
    });
  });

  describe('registerUploadedFile — rollback en fallo', () => {
    it('elimina el archivo en storage si registerFile lanza', async () => {
      prisma.storedFile.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.registerUploadedFile({
          organizationId: 'org-1',
          storageRef: 'private://org-1/file.jpg',
          kind: StoredFileKind.USER_AVATAR,
          visibility: 'private',
          entityType: 'USER',
          entityId: 'user-1',
        }),
      ).rejects.toThrow('DB error');

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'private://org-1/file.jpg',
      );
    });
  });
});
