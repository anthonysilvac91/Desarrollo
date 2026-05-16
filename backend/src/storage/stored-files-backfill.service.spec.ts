import { Test, TestingModule } from '@nestjs/testing';
import { StoredFilesBackfillService } from './stored-files-backfill.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

function buildPrismaMock() {
  return {
    storedFile: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
    organization: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    owner: { findMany: jest.fn().mockResolvedValue([]) },
    asset: { findMany: jest.fn().mockResolvedValue([]) },
    serviceAttachment: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

async function buildService(prisma: ReturnType<typeof buildPrismaMock>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StoredFilesBackfillService,
      { provide: PrismaService, useValue: prisma },
      {
        provide: StorageService,
        useValue: {
          canHandleFileRef: jest.fn().mockReturnValue(false),
          getFileSize: jest.fn().mockResolvedValue(null),
        },
      },
    ],
  }).compile();

  return module.get<StoredFilesBackfillService>(StoredFilesBackfillService);
}

describe('validateEntityTypeIntegrity', () => {
  it('reporta cero missing y sin valores inválidos cuando todo está migrado', async () => {
    const prisma = buildPrismaMock();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([]);

    const service = await buildService(prisma);
    const result = await service.validateEntityTypeIntegrity();

    expect(result.missing).toBe(0);
    expect(result.invalidValues).toHaveLength(0);
  });

  it('reporta el conteo de registros sin entity_type', async () => {
    const prisma = buildPrismaMock();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(7) }])
      .mockResolvedValueOnce([]);

    const service = await buildService(prisma);
    const result = await service.validateEntityTypeIntegrity();

    expect(result.missing).toBe(7);
  });

  it('convierte BigInt de la query raw a number en invalidValues', async () => {
    const prisma = buildPrismaMock();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([{ entity_type: 'COMPANY', count: BigInt(3) }]);

    const service = await buildService(prisma);
    const result = await service.validateEntityTypeIntegrity();

    expect(result.invalidValues).toEqual([{ entity_type: 'COMPANY', count: 3 }]);
  });
});
