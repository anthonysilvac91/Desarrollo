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
    company: { findMany: jest.fn().mockResolvedValue([]) },
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

describe('backfillEntityFields', () => {
  it('actualiza entity_type y entity_id para registros sin ellos', async () => {
    const prisma = buildPrismaMock();
    prisma.storedFile.findMany
      .mockResolvedValueOnce([
        { id: 'sf-1', owner_type: 'ASSET', owner_id: 'asset-1' },
        { id: 'sf-2', owner_type: 'USER', owner_id: 'user-1' },
      ])
      .mockResolvedValueOnce([]);
    prisma.storedFile.update.mockResolvedValue({});

    const service = await buildService(prisma);
    const result = await service.backfillEntityFields();

    expect(result.scanned).toBe(2);
    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.warnings).toBe(0);
    expect(prisma.storedFile.update).toHaveBeenCalledWith({
      where: { id: 'sf-1' },
      data: { entity_type: 'ASSET', entity_id: 'asset-1' },
    });
    expect(prisma.storedFile.update).toHaveBeenCalledWith({
      where: { id: 'sf-2' },
      data: { entity_type: 'USER', entity_id: 'user-1' },
    });
  });

  it('mapea COMPANY a OWNER en entity_type durante el backfill', async () => {
    const prisma = buildPrismaMock();
    prisma.storedFile.findMany
      .mockResolvedValueOnce([{ id: 'sf-3', owner_type: 'COMPANY', owner_id: 'company-1' }])
      .mockResolvedValueOnce([]);
    prisma.storedFile.update.mockResolvedValue({});

    const service = await buildService(prisma);
    await service.backfillEntityFields();

    expect(prisma.storedFile.update).toHaveBeenCalledWith({
      where: { id: 'sf-3' },
      data: { entity_type: 'OWNER', entity_id: 'company-1' },
    });
  });

  it('respeta dryRun: cuenta updated sin llamar a update', async () => {
    const prisma = buildPrismaMock();
    prisma.storedFile.findMany
      .mockResolvedValueOnce([{ id: 'sf-4', owner_type: 'SERVICE', owner_id: 'svc-1' }])
      .mockResolvedValueOnce([]);

    const service = await buildService(prisma);
    const result = await service.backfillEntityFields({ dryRun: true });

    expect(prisma.storedFile.update).not.toHaveBeenCalled();
    expect(result.updated).toBe(1);
    expect(result.scanned).toBe(1);
  });

  it('emite warning y omite registros con owner_type desconocido', async () => {
    const prisma = buildPrismaMock();
    prisma.storedFile.findMany
      .mockResolvedValueOnce([{ id: 'sf-5', owner_type: 'UNKNOWN_TYPE', owner_id: 'x' }])
      .mockResolvedValueOnce([]);

    const service = await buildService(prisma);
    const result = await service.backfillEntityFields();

    expect(prisma.storedFile.update).not.toHaveBeenCalled();
    expect(result.warnings).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
  });

  it('consulta solo registros con entity_type null', async () => {
    const prisma = buildPrismaMock();
    prisma.storedFile.findMany.mockResolvedValueOnce([]);

    const service = await buildService(prisma);
    await service.backfillEntityFields();

    expect(prisma.storedFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entity_type: null } }),
    );
  });

  it('procesa múltiples páginas con cursor', async () => {
    const prisma = buildPrismaMock();
    prisma.storedFile.findMany
      .mockResolvedValueOnce([
        { id: 'sf-10', owner_type: 'ORGANIZATION', owner_id: 'org-1' },
      ])
      .mockResolvedValueOnce([
        { id: 'sf-11', owner_type: 'ASSET', owner_id: 'asset-2' },
      ])
      .mockResolvedValueOnce([]);
    prisma.storedFile.update.mockResolvedValue({});

    const service = await buildService(prisma);
    const result = await service.backfillEntityFields();

    expect(result.scanned).toBe(2);
    expect(result.updated).toBe(2);
    expect(prisma.storedFile.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.storedFile.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: { id: 'sf-10' }, skip: 1 }),
    );
  });
});

describe('validateEntityTypeIntegrity', () => {
  it('reporta cero missing y sin valores inválidos cuando todo está migrado', async () => {
    const prisma = buildPrismaMock();
    prisma.storedFile.count.mockResolvedValue(0);
    prisma.$queryRaw.mockResolvedValue([]);

    const service = await buildService(prisma);
    const result = await service.validateEntityTypeIntegrity();

    expect(result.missing).toBe(0);
    expect(result.invalidValues).toHaveLength(0);
  });

  it('reporta el conteo de registros sin entity_type', async () => {
    const prisma = buildPrismaMock();
    prisma.storedFile.count.mockResolvedValue(7);
    prisma.$queryRaw.mockResolvedValue([]);

    const service = await buildService(prisma);
    const result = await service.validateEntityTypeIntegrity();

    expect(result.missing).toBe(7);
  });

  it('convierte BigInt de la query raw a number en invalidValues', async () => {
    const prisma = buildPrismaMock();
    prisma.storedFile.count.mockResolvedValue(0);
    prisma.$queryRaw.mockResolvedValue([{ entity_type: 'COMPANY', count: BigInt(3) }]);

    const service = await buildService(prisma);
    const result = await service.validateEntityTypeIntegrity();

    expect(result.invalidValues).toEqual([{ entity_type: 'COMPANY', count: 3 }]);
  });
});
