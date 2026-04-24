import { Test, TestingModule } from '@nestjs/testing';
import { AssetsService } from './assets.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

describe('AssetsService.create - Worker Roles', () => {
  let service: AssetsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      asset: { create: jest.fn() },
    };

    const storageMock = {
      uploadFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('Debería inyectar el organization_id del Worker al crear un activo', async () => {
    jest.spyOn(prisma.asset, 'create').mockImplementation((args: any) => Promise.resolve(args.data));

    const result = await service.create({ name: 'Nuevo Activo de Terreno' }, 'org-tenant-123');

    expect(prisma.asset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ 
        name: 'Nuevo Activo de Terreno',
        organization_id: 'org-tenant-123'
      })
    }));
    expect(result).toHaveProperty('organization_id', 'org-tenant-123');
  });

  // Nota de seguridad implementada: Las reglas de edición no son comprobables aquí en unit tests 
  // porque hemos definido deliberadamente NO tener un endpoint Controller para PATCH de Assets,
  // bloqueando el acceso al Worker de manera estructural y limpia en el API Surface.
});
