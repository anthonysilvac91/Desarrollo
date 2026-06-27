import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { extensionMatchesVideoMime } from '../common/files/video-signature-validation';
import { resolveStorageQuotaBytes } from '../storage/resolve-storage-quota';

export interface AttachmentPolicy {
  videoUploadsEnabled: boolean;
  maxVideoFileBytes: bigint;
  maxBatchSize: number;
  uploadConcurrency: number;
  allowedVideoMimeTypes: string[];
  quotaBytes: bigint;
  readyBytes: bigint;
  reservedBytes: bigint;
  availableBytes: bigint;
}

@Injectable()
export class UploadPolicyService {
  private readonly logger = new Logger(UploadPolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  parseBytes(value: string): bigint {
    if (!/^[0-9]+$/.test(String(value))) {
      throw new BadRequestException(
        'El tamano del archivo debe ser un entero positivo',
      );
    }
    const parsed = BigInt(value);
    if (parsed <= 0n) {
      throw new BadRequestException(
        'El tamano del archivo debe ser mayor a cero',
      );
    }
    return parsed;
  }

  async resolvePolicy(organizationId: string): Promise<AttachmentPolicy> {
    const [org, subscription] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          video_uploads_enabled: true,
          storage_quota_bytes: true,
          max_video_file_bytes: true,
          upload_concurrency_limit: true,
        },
      }),
      this.prisma.subscription.findUnique({
        where: { organization_id: organizationId },
        select: { max_storage_gb: true, max_video_hours: true },
      }),
    ]);

    if (!org) {
      throw new ForbiddenException('Organizacion no disponible');
    }

    if (!subscription) {
      throw new ForbiddenException({
        error: 'SUBSCRIPTION_REQUIRED',
        message:
          'La organizacion no tiene una suscripcion activa. Contacte al administrador.',
      });
    }

    const quotaBytes = resolveStorageQuotaBytes({
      orgStorageQuotaBytes: org.storage_quota_bytes,
      subscriptionMaxStorageGb: subscription.max_storage_gb,
      envFallbackBytes: BigInt(
        this.configService.get<string>(
          'ORG_STORAGE_QUOTA_BYTES',
          String(100 * 1024 * 1024),
        ),
      ),
    });
    const maxVideoFileBytes =
      org.max_video_file_bytes ??
      BigInt(
        this.configService.get<string>(
          'SERVICE_VIDEO_MAX_FILE_BYTES',
          '524288000',
        ),
      );
    const allowedVideoMimeTypes = this.configService
      .get<string>(
        'SERVICE_UPLOAD_ALLOWED_VIDEO_MIMES',
        'video/mp4,video/webm,video/quicktime',
      )
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const [{ _sum: readySum }, { _sum: reservedSum }] = await Promise.all([
      this.prisma.storedFile.aggregate({
        where: { organization_id: organizationId, status: 'READY' },
        _sum: { size_bytes: true },
      }),
      this.prisma.fileUpload.aggregate({
        where: {
          organization_id: organizationId,
          status: { in: ['PENDING', 'UPLOADING', 'UPLOADED'] },
        },
        _sum: { declared_size_bytes: true },
      }),
    ]);

    const readyBytes = BigInt(readySum.size_bytes ?? 0);
    const reservedBytes = reservedSum.declared_size_bytes ?? 0n;
    const availableBytes =
      quotaBytes > 0n ? quotaBytes - readyBytes - reservedBytes : 0n;

    const videoUploadsEnabled =
      subscription.max_video_hours > 0 ||
      org.video_uploads_enabled;

    this.logger.log(
      JSON.stringify({
        event: 'policy_resolved',
        organizationId,
        videoUploadsEnabled,
        maxVideoHours: subscription.max_video_hours,
        orgOverride: org.video_uploads_enabled,
        quotaBytes: String(quotaBytes),
        availableBytes: String(availableBytes > 0n ? availableBytes : 0n),
      }),
    );

    return {
      videoUploadsEnabled,
      maxVideoFileBytes,
      maxBatchSize: Number(
        this.configService.get<string>('SERVICE_UPLOAD_MAX_BATCH_SIZE', '20'),
      ),
      uploadConcurrency:
        org.upload_concurrency_limit ||
        Number(
          this.configService.get<string>(
            'SERVICE_UPLOAD_DEFAULT_CONCURRENCY',
            '2',
          ),
        ),
      allowedVideoMimeTypes,
      quotaBytes,
      readyBytes,
      reservedBytes,
      availableBytes: availableBytes > 0n ? availableBytes : 0n,
    };
  }

  validateVideoIntent(
    policy: AttachmentPolicy,
    originalName: string,
    mimeType: string,
    sizeBytes: bigint,
  ): void {
    const normalizedMime = mimeType.toLowerCase();
    if (!policy.videoUploadsEnabled) {
      throw new ForbiddenException(
        'La carga de videos no esta habilitada para esta organizacion',
      );
    }
    if (sizeBytes > policy.maxVideoFileBytes) {
      throw new PayloadTooLargeException(
        'El video supera el tamano maximo permitido',
      );
    }
    if (!policy.allowedVideoMimeTypes.includes(normalizedMime)) {
      throw new BadRequestException('Formato de video no permitido');
    }
    if (!extensionMatchesVideoMime(originalName, normalizedMime)) {
      throw new BadRequestException(
        'La extension del archivo no coincide con el formato declarado',
      );
    }
    if (policy.quotaBytes > 0n && sizeBytes > policy.availableBytes) {
      this.logger.warn(
        JSON.stringify({
          event: 'storage_quota_exceeded',
          context: 'validateVideoIntent',
          file: originalName,
          requestedBytes: String(sizeBytes),
          availableBytes: String(policy.availableBytes),
          quotaBytes: String(policy.quotaBytes),
          readyBytes: String(policy.readyBytes),
          reservedBytes: String(policy.reservedBytes),
        }),
      );
      throw new PayloadTooLargeException(
        'No hay almacenamiento disponible para este archivo',
      );
    }
  }
}
