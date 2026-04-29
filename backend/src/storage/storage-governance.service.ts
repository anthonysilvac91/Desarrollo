import {
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

export interface OrganizationStorageUsage {
  organizationId: string;
  bytesUsed: number;
  fileCount: number;
  quotaBytes: number | null;
  availableBytes: number | null;
  quotaExceeded: boolean;
}

export interface OrganizationStorageReconcileResult {
  organizationId: string;
  referencedFiles: number;
  storedFiles: number;
  orphanedFiles: string[];
  deletedFiles: string[];
}

@Injectable()
export class StorageGovernanceService {
  private readonly logger = new Logger(StorageGovernanceService.name);
  private readonly quotaBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.quotaBytes = this.configService.get<number>('ORG_STORAGE_QUOTA_BYTES', 100 * 1024 * 1024);
  }

  async getOrganizationUsage(organizationId: string): Promise<OrganizationStorageUsage> {
    const refs = await this.listOrganizationFileRefs(organizationId);
    const sizes = await Promise.all(refs.map((ref) => this.storageService.getFileSize(ref)));
    const bytesUsed = sizes.reduce<number>((total, size) => total + (size ?? 0), 0);
    const quotaBytes = this.quotaBytes > 0 ? this.quotaBytes : null;

    return {
      organizationId,
      bytesUsed,
      fileCount: refs.length,
      quotaBytes,
      availableBytes: quotaBytes === null ? null : Math.max(quotaBytes - bytesUsed, 0),
      quotaExceeded: quotaBytes === null ? false : bytesUsed > quotaBytes,
    };
  }

  async assertCanStore(
    organizationId: string,
    incomingBytes: number,
    replacedFileIds: string[] = [],
  ): Promise<void> {
    if (!organizationId || this.quotaBytes <= 0 || incomingBytes <= 0) {
      return;
    }

    const replacedFileRefs = await this.listStoredFileRefsByIds(replacedFileIds);
    const usage = await this.getOrganizationUsage(organizationId);
    const replacedSizes = await Promise.all(
      replacedFileRefs
        .filter((ref) => !!ref)
        .map((ref) => this.storageService.getFileSize(ref)),
    );
    const bytesToReplace = replacedSizes.reduce<number>((total, size) => total + (size ?? 0), 0);
    const projectedBytes = usage.bytesUsed - bytesToReplace + incomingBytes;

    if (projectedBytes > this.quotaBytes) {
      throw new PayloadTooLargeException(
        `La organizacion superaria su cuota de storage (${this.quotaBytes} bytes)`,
      );
    }
  }

  async reconcileOrganizationFiles(
    organizationId: string,
    deleteOrphans = false,
  ): Promise<OrganizationStorageReconcileResult> {
    const referencedRefs = await this.listOrganizationFileRefs(organizationId);
    const referencedSet = new Set(referencedRefs);
    const storedRefs = await this.storageService.listFileRefs(organizationId);
    const orphanedFiles = storedRefs.filter((ref) => !referencedSet.has(ref));
    const deletedFiles: string[] = [];

    if (deleteOrphans) {
      for (const orphanRef of orphanedFiles) {
        await this.storageService.deleteFile(orphanRef);
        deletedFiles.push(orphanRef);
      }
      this.logger.log(
        `Storage reconcile for org ${organizationId}: deleted ${deletedFiles.length} orphaned files`,
      );
    }

    return {
      organizationId,
      referencedFiles: referencedRefs.length,
      storedFiles: storedRefs.length,
      orphanedFiles,
      deletedFiles,
    };
  }

  private async listOrganizationFileRefs(organizationId: string): Promise<string[]> {
    const storedFiles = await this.prisma.storedFile.findMany({
      where: { organization_id: organizationId },
      select: { storage_ref: true },
    });

    return Array.from(
      new Set(
        storedFiles
          .map((item) => item.storage_ref)
          .filter((ref): ref is string => !!ref && this.storageService.canHandleFileRef(ref)),
      ),
    );
  }

  private async listStoredFileRefsByIds(storedFileIds: string[]): Promise<string[]> {
    const ids = storedFileIds.filter((id) => !!id);
    if (!ids.length) {
      return [];
    }

    const storedFiles = await this.prisma.storedFile.findMany({
      where: { id: { in: ids } },
      select: { storage_ref: true },
    });

    return storedFiles
      .map((item) => item.storage_ref)
      .filter((ref): ref is string => !!ref && this.storageService.canHandleFileRef(ref));
  }
}
