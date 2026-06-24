import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageModule } from '../storage/storage.module';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { UploadsController } from './uploads.controller';
import { CloudflareWebhookController } from '../cloudflare/cloudflare-webhook.controller';
import { UploadsService } from './uploads.service';
import { UploadPolicyService } from './upload-policy.service';
import { UploadVerificationService } from './upload-verification.service';
import { UploadCleanupService } from './upload-cleanup.service';
import { MaintenanceLockService } from './maintenance-lock.service';
import { UploadReconciliationService } from './upload-reconciliation.service';
import { UploadMaintenanceService } from './upload-maintenance.service';

@Module({
  imports: [StorageModule, CloudflareModule],
  controllers: [UploadsController, CloudflareWebhookController],
  providers: [
    PrismaService,
    UploadsService,
    UploadPolicyService,
    UploadVerificationService,
    UploadCleanupService,
    MaintenanceLockService,
    UploadReconciliationService,
    UploadMaintenanceService,
  ],
  exports: [
    UploadsService,
    UploadPolicyService,
    UploadMaintenanceService,
    UploadReconciliationService,
  ],
})
export class UploadsModule {}
