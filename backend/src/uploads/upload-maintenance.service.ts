import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceLockService } from './maintenance-lock.service';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadReconciliationService } from './upload-reconciliation.service';
import { CloudflareService } from '../cloudflare/cloudflare.service';
import { UploadsService } from './uploads.service';

@Injectable()
export class UploadMaintenanceService {
  private readonly logger = new Logger(UploadMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locks: MaintenanceLockService,
    private readonly cleanup: UploadCleanupService,
    private readonly reconciliation: UploadReconciliationService,
    private readonly cloudflareService: CloudflareService,
    private readonly uploadsService: UploadsService,
  ) {}

  async runHourlyMaintenance() {
    const lock = await this.locks.acquire('upload-maintenance-hourly', 55 * 60);
    if (!lock) {
      return {
        status: 'skipped',
        expiredCount: 0,
        reconciledCount: 0,
        issueCount: 0,
      };
    }

    const run = await this.prisma.uploadMaintenanceRun.create({
      data: { job_name: 'upload-maintenance-hourly', status: 'RUNNING' },
    });

    try {
      const cleanupResult = await this.cleanup.expireStaleUploads();
      await this.syncStreamStatuses();
      const reconcileResult =
        await this.reconciliation.reconcileAllOrganizations();

      await this.prisma.uploadMaintenanceRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          finished_at: new Date(),
          expired_count: cleanupResult.expired,
          reconciled_count: reconcileResult.reconciled,
          issue_count: reconcileResult.issues,
        },
      });

      this.logger.log(
        JSON.stringify({
          event: 'upload_maintenance_completed',
          runId: run.id,
          expiredCount: cleanupResult.expired,
          reconciledCount: reconcileResult.reconciled,
          issueCount: reconcileResult.issues,
        }),
      );

      return {
        status: 'success',
        expiredCount: cleanupResult.expired,
        reconciledCount: reconcileResult.reconciled,
        issueCount: reconcileResult.issues,
      };
    } catch (error) {
      await this.prisma.uploadMaintenanceRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finished_at: new Date(),
          error_message:
            error instanceof Error ? error.message : 'unknown_error',
        },
      });
      this.logger.error(
        JSON.stringify({
          event: 'upload_maintenance_failed',
          runId: run.id,
          error: error instanceof Error ? error.message : 'unknown_error',
        }),
      );
      throw error;
    } finally {
      await this.locks.release(lock);
    }
  }

  async syncStreamStatuses() {
    if (!this.cloudflareService.isConfigured()) return;

    const pending = await this.prisma.fileUpload.findMany({
      where: {
        media_type: 'VIDEO',
        cf_stream_uid: { not: null },
        cf_stream_ready_to_stream: false,
        status: { in: ['UPLOADING', 'UPLOADED'] },
      },
      take: 50,
    });

    for (const upload of pending) {
      try {
        const status = await this.cloudflareService.getStreamStatus(upload.cf_stream_uid!);
        if (status.readyToStream) {
          await this.uploadsService.markStreamReady(upload.id, {
            duration: status.duration,
            thumbnail: status.thumbnail,
          });
        } else if (status.status === 'error') {
          await this.uploadsService.markStreamFailed(upload.id, 'cloudflare_processing_error');
        }
      } catch (e: any) {
        this.logger.warn(`Error syncing CF Stream status for ${upload.cf_stream_uid}: ${e.message}`);
      }
    }

    if (pending.length > 0) {
      this.logger.log(`Synced CF Stream statuses: ${pending.length} checked`);
    }
  }
}
