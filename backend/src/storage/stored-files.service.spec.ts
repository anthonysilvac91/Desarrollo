import { Test, TestingModule } from '@nestjs/testing';
import { StoredFileKind } from '@prisma/client';
import { StoredFilesService, toEntityType } from './stored-files.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

describe('toEntityType', () => {
  it.each([
    ['ORGANIZATION', 'ORGANIZATION'],
    ['USER', 'USER'],
    ['ASSET', 'ASSET'],
    ['SERVICE', 'SERVICE'],
    ['COMPANY', 'OWNER'],
  ])('mapea %s -> %s', (input, expected) => {
    expect(toEntityType(input)).toBe(expected);
  });
});

describe('StoredFilesService', () => {
  let service: StoredFilesService;
  let prisma: { storedFile: { create: jest.Mock; findUnique: jest.Mock; deleteMany: jest.Mock } };
  let storageService: { deleteFile: jest.Mock; resolveFileUrl: jest.Mock; canHandleFileRef: jest.Mock };

  beforeEach(async () => {
    prisma = {
      storedFile: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
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
    it('escribe entity_type y entity_id junto con owner_type y owner_id', async () => {
      prisma.storedFile.create.mockResolvedValue({ id: 'sf-1' });

      await service.registerFile({
        organizationId: 'org-1',
        storageRef: 'private://org-1/thumb.jpg',
        kind: StoredFileKind.ASSET_THUMBNAIL,
        visibility: 'private',
        ownerType: 'ASSET',
        ownerId: 'asset-1',
      });

      expect(prisma.storedFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            owner_type: 'ASSET',
            owner_id: 'asset-1',
            entity_type: 'ASSET',
            entity_id: 'asset-1',
          }),
        }),
      );
    });

    it('escribe owner_type y entity_type como OWNER para logos de owner', async () => {
      prisma.storedFile.create.mockResolvedValue({ id: 'sf-2' });

      await service.registerFile({
        organizationId: 'org-1',
        storageRef: 'private://org-1/logo.jpg',
        kind: StoredFileKind.OWNER_LOGO,
        visibility: 'private',
        ownerType: 'OWNER',
        ownerId: 'owner-1',
      });

      expect(prisma.storedFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            owner_type: 'OWNER',
            owner_id: 'owner-1',
            entity_type: 'OWNER',
            entity_id: 'owner-1',
          }),
        }),
      );
    });

    it('entity_id coincide con owner_id para todos los tipos', async () => {
      prisma.storedFile.create.mockResolvedValue({ id: 'sf-3' });

      await service.registerFile({
        organizationId: 'org-1',
        storageRef: 'private://org-1/org-logo.jpg',
        kind: StoredFileKind.ORG_LOGO,
        visibility: 'public',
        ownerType: 'ORGANIZATION',
        ownerId: 'org-1',
      });

      const callData = prisma.storedFile.create.mock.calls[0][0].data;
      expect(callData.entity_id).toBe(callData.owner_id);
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
          ownerType: 'USER',
          ownerId: 'user-1',
        }),
      ).rejects.toThrow('DB error');

      expect(storageService.deleteFile).toHaveBeenCalledWith('private://org-1/file.jpg');
    });
  });
});
