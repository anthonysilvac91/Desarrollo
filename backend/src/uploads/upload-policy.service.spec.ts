import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadPolicyService } from './upload-policy.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UploadPolicyService', () => {
  let service: UploadPolicyService;
  let prisma: any;
  let configService: any;

  const configDefaults: Record<string, string> = {
    ORG_STORAGE_QUOTA_BYTES: String(100 * 1024 * 1024),
    SERVICE_VIDEO_MAX_FILE_BYTES: '524288000',
    SERVICE_VIDEO_UPLOADS_ENABLED: 'false',
    SERVICE_UPLOAD_ALLOWED_VIDEO_MIMES: 'video/mp4,video/webm,video/quicktime',
    SERVICE_UPLOAD_MAX_BATCH_SIZE: '20',
    SERVICE_UPLOAD_DEFAULT_CONCURRENCY: '2',
  };

  beforeEach(async () => {
    const prismaMock = {
      organization: { findUnique: jest.fn() },
      subscription: { findUnique: jest.fn() },
      storedFile: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { size_bytes: null } }),
      },
      fileUpload: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { declared_size_bytes: null } }),
      },
    };

    const configMock = {
      get: jest.fn((key: string, def?: string) => configDefaults[key] ?? def),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadPolicyService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get(UploadPolicyService);
    prisma = module.get(PrismaService);
    configService = module.get(ConfigService);
  });

  describe('resolvePolicy', () => {
    it('org sin subscription lanza SUBSCRIPTION_REQUIRED', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        video_uploads_enabled: false,
        storage_quota_bytes: null,
        max_video_file_bytes: null,
        upload_concurrency_limit: null,
      });
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.resolvePolicy('org-1')).rejects.toThrow(
        ForbiddenException,
      );

      try {
        await service.resolvePolicy('org-1');
      } catch (e: any) {
        expect(e.response.error).toBe('SUBSCRIPTION_REQUIRED');
      }
    });

    it('BUSINESS subscription resuelve 200 GB de cuota', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        video_uploads_enabled: true,
        storage_quota_bytes: null,
        max_video_file_bytes: null,
        upload_concurrency_limit: null,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 200,
      });

      const policy = await service.resolvePolicy('org-1');

      expect(policy.quotaBytes).toBe(200n * 1024n * 1024n * 1024n);
    });

    it('org override prevalece sobre subscription', async () => {
      const customQuota = 500n * 1024n * 1024n * 1024n;
      prisma.organization.findUnique.mockResolvedValue({
        video_uploads_enabled: false,
        storage_quota_bytes: customQuota,
        max_video_file_bytes: null,
        upload_concurrency_limit: null,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 200,
      });

      const policy = await service.resolvePolicy('org-1');

      expect(policy.quotaBytes).toBe(customQuota);
    });

    it('video global ON + org OFF = videoUploadsEnabled false', async () => {
      configDefaults['SERVICE_VIDEO_UPLOADS_ENABLED'] = 'false';
      prisma.organization.findUnique.mockResolvedValue({
        video_uploads_enabled: false,
        storage_quota_bytes: null,
        max_video_file_bytes: null,
        upload_concurrency_limit: null,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 200,
      });

      const policy = await service.resolvePolicy('org-1');

      expect(policy.videoUploadsEnabled).toBe(false);
    });

    it('video global OFF + org ON = videoUploadsEnabled true', async () => {
      configDefaults['SERVICE_VIDEO_UPLOADS_ENABLED'] = 'false';
      prisma.organization.findUnique.mockResolvedValue({
        video_uploads_enabled: true,
        storage_quota_bytes: null,
        max_video_file_bytes: null,
        upload_concurrency_limit: null,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 200,
      });

      const policy = await service.resolvePolicy('org-1');

      expect(policy.videoUploadsEnabled).toBe(true);
    });

    it('video global ON + org ON = videoUploadsEnabled true', async () => {
      configDefaults['SERVICE_VIDEO_UPLOADS_ENABLED'] = 'true';
      prisma.organization.findUnique.mockResolvedValue({
        video_uploads_enabled: true,
        storage_quota_bytes: null,
        max_video_file_bytes: null,
        upload_concurrency_limit: null,
      });
      prisma.subscription.findUnique.mockResolvedValue({
        max_storage_gb: 200,
      });

      const policy = await service.resolvePolicy('org-1');

      expect(policy.videoUploadsEnabled).toBe(true);
    });
  });

  describe('validateVideoIntent', () => {
    const basePolicy = {
      videoUploadsEnabled: true,
      maxVideoFileBytes: 524288000n,
      maxBatchSize: 20,
      uploadConcurrency: 2,
      allowedVideoMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
      quotaBytes: 200n * 1024n * 1024n * 1024n,
      readyBytes: 0n,
      reservedBytes: 0n,
      availableBytes: 200n * 1024n * 1024n * 1024n,
    };

    it('video uploads disabled rechaza con ForbiddenException', () => {
      expect(() =>
        service.validateVideoIntent(
          { ...basePolicy, videoUploadsEnabled: false },
          'test.mp4',
          'video/mp4',
          1000n,
        ),
      ).toThrow(ForbiddenException);
    });

    it('archivo que excede cuota lanza PayloadTooLargeException', () => {
      const policy = {
        ...basePolicy,
        quotaBytes: 100n * 1024n * 1024n,
        availableBytes: 50n * 1024n * 1024n,
      };

      expect(() =>
        service.validateVideoIntent(
          policy,
          'test.mp4',
          'video/mp4',
          60n * 1024n * 1024n,
        ),
      ).toThrow(PayloadTooLargeException);
    });

    it('archivo dentro de cuota pasa la validación', () => {
      expect(() =>
        service.validateVideoIntent(
          basePolicy,
          'test.mp4',
          'video/mp4',
          50n * 1024n * 1024n,
        ),
      ).not.toThrow();
    });
  });
});
