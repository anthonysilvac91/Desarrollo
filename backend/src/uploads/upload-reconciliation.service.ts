import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadsService } from './uploads.service';

export interface ReconcileOrgResult {
  organizationId: string;
  readyBytes: bigint;
  reservedBytes: bigint;
  readyFileCount: number;
  pendingUploadCount: number;
  issueCount: number;
}

const ACTIVE_UPLOAD_STATUSES = ['PENDING', 'UPLOADING', 'UPLOADED'] as const;

@Injectable()
export class UploadReconciliationService {
  private readonly logger = new Logger(UploadReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly uploadsService: UploadsService,
  ) {}

  async reconcileAllOrganizations(): Promise<{
    reconciled: number;
    issues: number;
  }> {
    const organizations = await this.prisma.organization.findMany({
      where: { is_active: true },
      select: { id: true },
    });

    let issues = 0;
    for (const organization of organizations) {
      const result = await this.reconcileOrganization(organization.id);
      issues += result.issueCount;
    }

    return { reconciled: organizations.length, issues };
  }

  async reconcileOrganization(
    organizationId: string,
  ): Promise<ReconcileOrgResult> {
    const [readyAggregate, readyCount, activeUploads, services, storedFiles] =
      await Promise.all([
        this.prisma.storedFile.aggregate({
          where: { organization_id: organizationId, status: 'READY' },
          _sum: { size_bytes: true },
        }),
        this.prisma.storedFile.count({
          where: { organization_id: organizationId, status: 'READY' },
        }),
        this.prisma.fileUpload.findMany({
          where: {
            organization_id: organizationId,
            status: { in: [...ACTIVE_UPLOAD_STATUSES] },
          },
          select: {
            id: true,
            storage_ref: true,
            declared_size_bytes: true,
            service_id: true,
            status: true,
          },
        }),
        this.prisma.service.findMany({
          where: { organization_id: organizationId },
          select: { id: true },
        }),
        this.prisma.storedFile.findMany({
          where: { organization_id: organizationId, status: 'READY' },
          select: {
            id: true,
            storage_ref: true,
            entity_type: true,
            entity_id: true,
          },
        }),
      ]);

    const readyBytes = BigInt(readyAggregate._sum.size_bytes ?? 0);
    const reservedBytes = activeUploads.reduce(
      (sum, upload) => sum + upload.declared_size_bytes,
      0n,
    );
    const storageRefs = await this.listOrganizationStorageRefs(organizationId);
    const storageRefSet = new Set(storageRefs);
    const registeredRefSet = new Set(
      storedFiles.map((file) => file.storage_ref),
    );
    const uploadRefSet = new Set(
      activeUploads.map((upload) => upload.storage_ref),
    );
    let issueCount = 0;

    for (const file of storedFiles) {
      if (!storageRefSet.has(file.storage_ref)) {
        await this.recordIssue(
          organizationId,
          'READY_FILE_MISSING_OBJECT',
          file.storage_ref,
          file.entity_type,
          file.entity_id,
        );
        issueCount += 1;
      }
    }

    for (const upload of activeUploads) {
      if (
        upload.status === 'UPLOADED' &&
        !storageRefSet.has(upload.storage_ref)
      ) {
        await this.recordIssue(
          organizationId,
          'UPLOADED_INTENT_MISSING_OBJECT',
          upload.storage_ref,
          'SERVICE',
          upload.service_id,
        );
        issueCount += 1;
      }
    }

    for (const storageRef of storageRefs) {
      if (!registeredRefSet.has(storageRef) && !uploadRefSet.has(storageRef)) {
        await this.recordIssue(
          organizationId,
          'OBJECT_WITHOUT_RECORD',
          storageRef,
          null,
          null,
        );
        issueCount += 1;
      }
    }

    await this.prisma.organizationStorageUsage.upsert({
      where: { organization_id: organizationId },
      create: {
        organization_id: organizationId,
        ready_bytes: readyBytes,
        reserved_bytes: reservedBytes,
        ready_file_count: readyCount,
        pending_upload_count: activeUploads.length,
        reconciled_at: new Date(),
      },
      update: {
        ready_bytes: readyBytes,
        reserved_bytes: reservedBytes,
        ready_file_count: readyCount,
        pending_upload_count: activeUploads.length,
        reconciled_at: new Date(),
      },
    });

    for (const service of services) {
      await this.uploadsService.refreshServiceAttachmentSnapshot(service.id);
    }

    this.logger.log(
      JSON.stringify({
        event: 'upload_storage_reconciled',
        organizationId,
        readyBytes: readyBytes.toString(),
        reservedBytes: reservedBytes.toString(),
        readyFileCount: readyCount,
        pendingUploadCount: activeUploads.length,
        issueCount,
      }),
    );

    return {
      organizationId,
      readyBytes,
      reservedBytes,
      readyFileCount: readyCount,
      pendingUploadCount: activeUploads.length,
      issueCount,
    };
  }

  private async listOrganizationStorageRefs(
    organizationId: string,
  ): Promise<string[]> {
    const prefixes = [
      `organizations/${organizationId}`,
      `org/${organizationId}`,
    ];
    const refs = await Promise.all(
      prefixes.map((prefix) => this.storageService.listFileRefs(prefix)),
    );
    return Array.from(new Set(refs.flat()));
  }

  private async recordIssue(
    organizationId: string,
    issueType: string,
    storageRef: string | null,
    entityType: string | null,
    entityId: string | null,
  ) {
    const existing = await this.prisma.storageReconciliationIssue.findFirst({
      where: {
        organization_id: organizationId,
        issue_type: issueType,
        storage_ref: storageRef,
        entity_type: entityType,
        entity_id: entityId,
        resolved_at: null,
      },
    });

    if (existing) return;

    await this.prisma.storageReconciliationIssue.create({
      data: {
        organization_id: organizationId,
        issue_type: issueType,
        storage_ref: storageRef,
        entity_type: entityType,
        entity_id: entityId,
      },
    });
  }
}
