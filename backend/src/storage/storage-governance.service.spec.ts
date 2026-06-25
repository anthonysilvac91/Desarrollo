import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageGovernanceService } from './storage-governance.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

describe('StorageGovernanceService', () => {
  let service: StorageGovernanceService;
  let prisma: any;

  beforeEach(async () => {
    const prismaMock = {
      organization: { findUnique: jest.fn() },
      subscription: { findUnique: jest.fn() },
      storedFile: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { size_bytes: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const storageMock = {
      getFileSize: jest.fn().mockResolvedValue(0),
      canHandleFileRef: jest.fn().mockReturnValue(true),
      listFileRefs: jest.fn().mockResolvedValue([]),
      deleteFile: jest.fn(),
    };

    const configMock = {
      get: jest.fn().mockReturnValue(String(100 * 1024 * 1024)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageGovernanceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get(StorageGovernanceService);
    prisma = module.get(PrismaService);
  });

  describe('assertCanStore', () => {
    it('allows upload when projected usage is within subscription quota', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        storage_quota_bytes: null,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 200,
      });
      prisma.storedFile.aggregate.mockResolvedValue({
        _sum: { size_bytes: 1000 },
      });

      await expect(
        service.assertCanStore('org-1', 50 * 1024 * 1024),
      ).resolves.toBeUndefined();
    });

    it('throws when projected usage exceeds subscription quota', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        storage_quota_bytes: null,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 1,
      });
      prisma.storedFile.aggregate.mockResolvedValue({
        _sum: { size_bytes: 1024 * 1024 * 1024 },
      });

      await expect(
        service.assertCanStore('org-1', 100),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('uses org override when present', async () => {
      const customQuota = BigInt(500 * 1024 * 1024);
      prisma.organization.findUnique.mockResolvedValue({
        storage_quota_bytes: customQuota,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 1,
      });
      prisma.storedFile.aggregate.mockResolvedValue({
        _sum: { size_bytes: 400 * 1024 * 1024 },
      });

      await expect(
        service.assertCanStore('org-1', 50 * 1024 * 1024),
      ).resolves.toBeUndefined();
    });

    it('org sin subscription lanza SUBSCRIPTION_REQUIRED', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        storage_quota_bytes: null,
      });
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.assertCanStore('org-1', 20 * 1024 * 1024),
      ).rejects.toThrow(ForbiddenException);

      try {
        await service.assertCanStore('org-1', 20 * 1024 * 1024);
      } catch (e: any) {
        expect(e.response.error).toBe('SUBSCRIPTION_REQUIRED');
      }
    });

    it('accounts for replaced file sizes', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        storage_quota_bytes: null,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 1,
      });

      prisma.storedFile.aggregate
        .mockResolvedValueOnce({ _sum: { size_bytes: 900 * 1024 * 1024 } })
        .mockResolvedValueOnce({ _sum: { size_bytes: 200 * 1024 * 1024 } });

      await expect(
        service.assertCanStore('org-1', 100 * 1024 * 1024, ['file-to-replace']),
      ).resolves.toBeUndefined();
    });

    it('skips check when incomingBytes is 0', async () => {
      await expect(
        service.assertCanStore('org-1', 0),
      ).resolves.toBeUndefined();
      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getOrganizationUsage', () => {
    it('returns correct quota from subscription plan', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        storage_quota_bytes: null,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 200,
      });

      const usage = await service.getOrganizationUsage('org-1');

      expect(usage.quotaBytes).toBe(Number(200n * 1024n * 1024n * 1024n));
      expect(usage.quotaExceeded).toBe(false);
    });

    it('returns correct quota from org override', async () => {
      const customQuota = BigInt(500 * 1024 * 1024);
      prisma.organization.findUnique.mockResolvedValue({
        storage_quota_bytes: customQuota,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 1,
      });

      const usage = await service.getOrganizationUsage('org-1');

      expect(usage.quotaBytes).toBe(Number(customQuota));
    });

    it('org sin subscription lanza SUBSCRIPTION_REQUIRED', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        storage_quota_bytes: null,
      });
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrganizationUsage('org-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
