import {
  ForbiddenException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { EmailService } from '../email/email.service';
import { resolveStorageQuotaBytes } from './resolve-storage-quota';

/** Umbrales (%) para el aviso de "almacenamiento cerca del limite", de mayor a menor. */
const STORAGE_ALERT_THRESHOLDS = [100, 80];

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
    private readonly emailService: EmailService,
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

  /**
   * Avisa a los admins cuando una organizacion alcanza 80% o 100% de su cuota.
   * Usa un "watermark" (last_storage_alert_pct) para no reenviar el mismo aviso
   * todos los dias mientras el uso se mantenga sobre el umbral ya notificado.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async warnStorageNearLimit(): Promise<void> {
    const usages = await this.prisma.organizationStorageUsage.findMany({
      include: {
        organization: {
          select: {
            name: true,
            storage_quota_bytes: true,
            subscription: { select: { max_storage_gb: true } },
          },
        },
      },
    });

    let warned = 0;
    for (const usage of usages) {
      const org = usage.organization;
      if (!org?.subscription) continue;

      const quotaBytes = resolveStorageQuotaBytes({
        orgStorageQuotaBytes: org.storage_quota_bytes ?? null,
        subscriptionMaxStorageGb: org.subscription.max_storage_gb,
        envFallbackBytes: BigInt(
          this.configService.get<string>(
            'ORG_STORAGE_QUOTA_BYTES',
            String(100 * 1024 * 1024),
          ),
        ),
      });
      if (quotaBytes <= 0n) continue;

      const usedBytes = usage.ready_bytes + usage.reserved_bytes;
      const pctUsed = Number((usedBytes * 10000n) / quotaBytes) / 100;
      const crossedThreshold =
        STORAGE_ALERT_THRESHOLDS.find((t) => pctUsed >= t) ?? null;

      if (crossedThreshold !== null) {
        if (
          usage.last_storage_alert_pct === null ||
          crossedThreshold > usage.last_storage_alert_pct
        ) {
          void this.notifyStorageNearLimit(
            usage.organization_id,
            org.name,
            usedBytes,
            quotaBytes,
            crossedThreshold,
          );
          await this.prisma.organizationStorageUsage.update({
            where: { organization_id: usage.organization_id },
            data: { last_storage_alert_pct: crossedThreshold },
          });
          warned += 1;
        }
      } else if (usage.last_storage_alert_pct !== null) {
        await this.prisma.organizationStorageUsage.update({
          where: { organization_id: usage.organization_id },
          data: { last_storage_alert_pct: null },
        });
      }
    }

    if (warned > 0) {
      this.logger.log(`Warned admins of ${warned} org(s) near storage limit`);
    }
  }

  /** Notifica a los admins activos de la organizacion. Nunca lanza. */
  private async notifyStorageNearLimit(
    orgId: string,
    orgName: string,
    usedBytes: bigint,
    quotaBytes: bigint,
    thresholdPct: number,
  ): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          organization_id: orgId,
          role: 'ADMIN',
          is_active: true,
          email_notifications_enabled: true,
        },
        select: { email: true, name: true, language: true },
      });
      const usedGb =
        Math.round((Number(usedBytes) / (1024 * 1024 * 1024)) * 100) / 100;
      const quotaGb =
        Math.round((Number(quotaBytes) / (1024 * 1024 * 1024)) * 100) / 100;

      await Promise.all(
        admins.map((admin) =>
          this.emailService
            .sendStorageNearLimit(
              admin.email,
              admin.name,
              orgName,
              usedGb,
              quotaGb,
              thresholdPct,
              admin.language as 'en' | 'es',
            )
            .catch((err) =>
              this.logger.error(
                `Failed to notify admin ${admin.email} of storage near limit`,
                err,
              ),
            ),
        ),
      );
    } catch (err) {
      this.logger.error(
        `Failed to send storage-near-limit notifications for org ${orgId}`,
        err,
      );
    }
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
