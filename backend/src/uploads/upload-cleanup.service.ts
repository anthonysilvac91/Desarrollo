import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadsService } from './uploads.service';

@Injectable()
export class UploadCleanupService {
  private readonly logger = new Logger(UploadCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly uploadsService: UploadsService,
    private readonly configService: ConfigService,
  ) {}

  async expireStaleUploads(limit = 100): Promise<{ expired: number }> {
    if (
      this.configService.get<string>(
        'SERVICE_UPLOAD_CLEANUP_ENABLED',
        'true',
      ) !== 'true'
    ) {
      return { expired: 0 };
    }

    const staleUploads = await this.prisma.fileUpload.findMany({
      where: {
        status: { in: ['PENDING', 'UPLOADING', 'UPLOADED'] },
        expires_at: { lt: new Date() },
      },
      take: limit,
      orderBy: { expires_at: 'asc' },
    });

    let expired = 0;
    for (const upload of staleUploads) {
      const updateResult = await this.prisma.fileUpload.updateMany({
        where: {
          id: upload.id,
          status: { in: ['PENDING', 'UPLOADING', 'UPLOADED'] },
        },
        data: { status: 'EXPIRED', failure_reason: 'cleanup_expired' },
      });

      if (updateResult.count === 0) {
        continue;
      }

      expired += 1;
      await this.storageService.deleteFile(upload.storage_ref);
      await this.prisma.$executeRaw`
        INSERT INTO "OrganizationStorageUsage" ("organization_id", "ready_bytes", "reserved_bytes", "ready_file_count", "pending_upload_count", "updated_at")
        VALUES (${upload.organization_id}, 0, 0, 0, 0, NOW())
        ON CONFLICT ("organization_id") DO UPDATE
          SET "reserved_bytes" = GREATEST("OrganizationStorageUsage"."reserved_bytes" - ${upload.declared_size_bytes}, 0),
              "pending_upload_count" = GREATEST("OrganizationStorageUsage"."pending_upload_count" - 1, 0),
              "updated_at" = NOW()
      `;
      await this.uploadsService.refreshServiceAttachmentSnapshot(
        upload.service_id,
      );
    }

    if (expired > 0) {
      this.logger.log(
        JSON.stringify({
          event: 'upload_cleanup_expired',
          expiredCount: expired,
        }),
      );
    }

    return { expired };
  }
}
