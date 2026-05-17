import { Test, TestingModule } from '@nestjs/testing';
import { AssetsService } from './assets.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';

describe('AssetsService.create - Worker Roles', () => {
  let service: AssetsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      asset: { 
        create: jest.fn(),
        findUnique: jest.fn()
      },
      owner: {
        findFirst: jest.fn(),
      },
    };

    const storageMock = {
      uploadFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: StorageGovernanceService, useValue: { assertCanStore: jest.fn() } },
        {
          provide: StoredFilesService,
          useValue: {
            resolveFileUrlOrRef: jest.fn((_: string | null, fallback?: string | null) => fallback ?? null),
            registerUploadedFile: jest.fn(),
            deleteStoredFileAndBlob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('Debería inyectar el organization_id del Worker al crear un activo', async () => {
    const mockAsset = { id: 'asset-1', name: 'Nuevo Activo de Terreno', organization_id: 'org-tenant-123', owner_id: 'owner-1' };
    jest.spyOn(prisma.owner, 'findFirst').mockResolvedValue({ id: 'owner-1' } as any);
    jest.spyOn(prisma.asset, 'create').mockResolvedValue(mockAsset as any);
    jest.spyOn(prisma.asset, 'findUnique').mockResolvedValue(mockAsset as any);

    const result = await service.create({ name: 'Nuevo Activo de Terreno', owner_id: 'owner-1' }, 'org-tenant-123');

    expect(prisma.asset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Nuevo Activo de Terreno',
        organization_id: 'org-tenant-123',
        owner_id: 'owner-1',
      })
    }));
    expect(result).toHaveProperty('organization_id', 'org-tenant-123');
  });

  // Nota de seguridad implementada: Las reglas de edición no son comprobables aquí en unit tests 
  // porque hemos definido deliberadamente NO tener un endpoint Controller para PATCH de Assets,
  // bloqueando el acceso al Worker de manera estructural y limpia en el API Surface.
});
