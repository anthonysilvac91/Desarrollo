import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OwnersService } from './companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageGovernanceService } from '../storage/storage-governance.service';
import { StoredFilesService } from '../storage/stored-files.service';

describe('OwnersService', () => {
  let service: OwnersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      owner: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      service: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      asset: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: { uploadFile: jest.fn() } },
        {
          provide: StorageGovernanceService,
          useValue: { assertCanStore: jest.fn() },
        },
        {
          provide: StoredFilesService,
          useValue: {
            resolveFileUrlForOrg: jest.fn().mockResolvedValue(null),
            resolveFileUrlsForOrg: jest.fn().mockResolvedValue(new Map()),
            registerUploadedFile: jest.fn(),
            deleteStoredFileAndBlob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OwnersService>(OwnersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create()', () => {
    it('rechaza nombre duplicado dentro de la misma organizacion', async () => {
      jest
        .spyOn(prisma.owner, 'findFirst')
        .mockResolvedValue({ id: 'owner-existing' } as any);

      await expect(
        service.create({ name: 'Marina Norte' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.owner.findFirst).toHaveBeenCalledWith({
        where: {
          organization_id: 'org-1',
          name: { equals: 'Marina Norte', mode: 'insensitive' },
        },
        select: { id: true },
      });
      expect(prisma.owner.create).not.toHaveBeenCalled();
    });

    it('normaliza espacios del nombre al crear owner', async () => {
      const owner = {
        id: 'owner-1',
        name: 'Marina Norte',
        organization_id: 'org-1',
      };
      jest.spyOn(prisma.owner, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.owner, 'create').mockResolvedValue(owner as any);

      const result = await service.create(
        { name: '  Marina Norte  ' },
        'org-1',
      );

      expect(prisma.owner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Marina Norte',
            organization_id: 'org-1',
          }),
        }),
      );
      expect(result).toHaveProperty('name', 'Marina Norte');
    });
  });
});
