import {
  ForbiddenException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { resolveStorageQuotaBytes } from './resolve-storage-quota';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  private async resolveQuotaForOrg(organizationId: string): Promise<bigint> {
    const [org, subscription] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { storage_quota_bytes: true },
      }),
      this.prisma.subscription.findUnique({
        where: { organization_id: organizationId },
        select: { max_storage_gb: true },
      }),
    ]);

    if (!subscription) {
      throw new ForbiddenException({
        error: 'SUBSCRIPTION_REQUIRED',
        message:
          'La organizacion no tiene una suscripcion activa. Contacte al administrador.',
      });
    }

    return resolveStorageQuotaBytes({
      orgStorageQuotaBytes: org?.storage_quota_bytes ?? null,
      subscriptionMaxStorageGb: subscription.max_storage_gb,
      envFallbackBytes: BigInt(
        this.configService.get<string>(
          'ORG_STORAGE_QUOTA_BYTES',
          String(100 * 1024 * 1024),
        ),
      ),
    });
  }

  async getOrganizationUsage(
    organizationId: string,
  ): Promise<OrganizationStorageUsage> {
    const refs = await this.listOrganizationFileRefs(organizationId);
    const sizes = await Promise.all(
      refs.map((ref) => this.storageService.getFileSize(ref)),
    );
    const bytesUsed = sizes.reduce<number>(
      (total, size) => total + (size ?? 0),
      0,
    );

    const quotaBigInt = await this.resolveQuotaForOrg(organizationId);
    const quotaBytes = quotaBigInt > 0n ? Number(quotaBigInt) : null;

    return {
      organizationId,
      bytesUsed,
      fileCount: refs.length,
      quotaBytes,
      availableBytes:
        quotaBytes === null ? null : Math.max(quotaBytes - bytesUsed, 0),
      quotaExceeded: quotaBytes === null ? false : bytesUsed > quotaBytes,
    };
  }

  async assertCanStore(
    organizationId: string,
    incomingBytes: number,
    replacedFileIds: string[] = [],
  ): Promise<void> {
    if (!organizationId || incomingBytes <= 0) {
      return;
    }

    const quotaBytes = await this.resolveQuotaForOrg(organizationId);
    if (quotaBytes <= 0n) {
      return;
    }

    const { _sum: usageSum } = await this.prisma.storedFile.aggregate({
      where: {
        organization_id: organizationId,
        status: { not: 'DELETED' as const },
      },
      _sum: { size_bytes: true },
    });
    const currentUsageBytes = BigInt(usageSum.size_bytes ?? 0);

    let bytesToReplace = 0n;
    if (replacedFileIds.length > 0) {
      const { _sum: replacedSum } = await this.prisma.storedFile.aggregate({
        where: { id: { in: replacedFileIds } },
        _sum: { size_bytes: true },
      });
      bytesToReplace = BigInt(replacedSum.size_bytes ?? 0);
    }

    const projectedBytes =
      currentUsageBytes - bytesToReplace + BigInt(incomingBytes);

    if (projectedBytes > quotaBytes) {
      this.logger.warn(
        JSON.stringify({
          event: 'storage_quota_exceeded',
          context: 'assertCanStore',
          organizationId,
          incomingBytes,
          currentUsageBytes: String(currentUsageBytes),
          bytesToReplace: String(bytesToReplace),
          projectedBytes: String(projectedBytes),
          quotaBytes: String(quotaBytes),
        }),
      );
      throw new PayloadTooLargeException(
        `La organizacion superaria su cuota de storage (${quotaBytes} bytes)`,
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

  private async listOrganizationFileRefs(
    organizationId: string,
  ): Promise<string[]> {
    const storedFiles = await this.prisma.storedFile.findMany({
      where: { organization_id: organizationId },
      select: { storage_ref: true },
    });

    return Array.from(
      new Set(
        storedFiles
          .map((item) => item.storage_ref)
          .filter(
            (ref): ref is string =>
              !!ref && this.storageService.canHandleFileRef(ref),
          ),
      ),
    );
  }

  private async listStoredFileRefsByIds(
    storedFileIds: string[],
  ): Promise<string[]> {
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
      .filter(
        (ref): ref is string =>
          !!ref && this.storageService.canHandleFileRef(ref),
      );
  }
}
