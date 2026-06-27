import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateUploadIntentDto } from './dto/create-upload-intent.dto';
import { UploadPolicyService } from './upload-policy.service';
import { UploadVerificationService } from './upload-verification.service';
import { CloudflareService } from '../cloudflare/cloudflare.service';
import { extensionForVideoMime } from '../common/files/video-signature-validation';
import { createHash, randomUUID } from 'crypto';
import { RealtimeService } from '../realtime/realtime.service';

const ACTIVE_UPLOAD_STATUSES = ['PENDING', 'UPLOADING', 'UPLOADED'] as const;
const FAILED_UPLOAD_STATUSES = ['FAILED', 'EXPIRED'] as const;

function toStringBytes(value: bigint | number | null | undefined): string {
  return String(value ?? 0);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly policyService: UploadPolicyService,
    private readonly verificationService: UploadVerificationService,
    private readonly configService: ConfigService,
    private readonly cloudflareService: CloudflareService,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  async getAttachmentConfig(user: any) {
    this.assertInternalUser(user);
    const policy = await this.policyService.resolvePolicy(user.orgId);
    return {
      videoUploadsEnabled: policy.videoUploadsEnabled,
      maxVideoFileBytes: policy.maxVideoFileBytes.toString(),
      maxBatchSize: policy.maxBatchSize,
      uploadConcurrency: policy.uploadConcurrency,
      allowedVideoMimeTypes: policy.allowedVideoMimeTypes,
      storage: {
        quotaBytes: policy.quotaBytes.toString(),
        readyBytes: policy.readyBytes.toString(),
        reservedBytes: policy.reservedBytes.toString(),
        availableBytes: policy.availableBytes.toString(),
      },
    };
  }

  async createIntent(serviceId: string, dto: CreateUploadIntentDto, user: any) {
    this.assertInternalUser(user);
    if (dto.mediaType !== 'VIDEO') {
      throw new BadRequestException(
        'Este endpoint esta habilitado para videos en esta fase',
      );
    }

    const service = await this.assertServiceAccess(serviceId, user);
    const policy = await this.policyService.resolvePolicy(
      service.organization_id,
    );
    const declaredSize = this.policyService.parseBytes(dto.sizeBytes);
    this.policyService.validateVideoIntent(
      policy,
      dto.originalName,
      dto.mimeType,
      declaredSize,
    );

    const pendingByUser = await this.prisma.fileUpload.count({
      where: {
        organization_id: service.organization_id,
        created_by_user_id: user.id,
        status: { in: [...ACTIVE_UPLOAD_STATUSES] },
      },
    });
    if (pendingByUser >= policy.maxBatchSize) {
      throw new BadRequestException(
        'Superaste el maximo de cargas pendientes permitidas',
      );
    }

    const uploadId = randomUUID();
    const useCfStream = this.cloudflareService.isConfigured();

    if (useCfStream) {
      const streamUpload = await this.cloudflareService.createStreamDirectUpload({
        maxDurationSeconds: 600,
        uploadLengthBytes: Number(declaredSize),
        organizationId: service.organization_id,
        serviceId,
        uploadId,
      });

      const expiresAt = new Date(streamUpload.expiresAt);

      await this.prisma.$transaction(
        async (tx) => {
          await this.assertQuotaAndReserve(tx, service.organization_id, declaredSize, policy);
          await tx.fileUpload.create({
            data: {
              id: uploadId,
              organization_id: service.organization_id,
              service_id: serviceId,
              created_by_user_id: user.id,
              storage_ref: `cf-stream://${streamUpload.uid}`,
              original_name: dto.originalName,
              declared_mime_type: dto.mimeType.toLowerCase(),
              declared_size_bytes: declaredSize,
              media_type: 'VIDEO',
              expires_at: expiresAt,
              cf_stream_uid: streamUpload.uid,
              cf_stream_upload_url: streamUpload.uploadUrl,
              cf_stream_status: 'pendingupload',
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );

      this.logger.log(
        JSON.stringify({
          event: 'upload_intent_created',
          uploadId,
          serviceId,
          organizationId: service.organization_id,
          userId: user.id,
          sizeBytes: String(declaredSize),
          mimeType: dto.mimeType,
          useCfStream: true,
          cfStreamUid: streamUpload.uid,
        }),
      );

      await this.refreshServiceAttachmentSnapshot(serviceId);
      this.emitAttachmentsUpdated(serviceId, service.organization_id, user.id);

      return {
        uploadId,
        mediaType: 'VIDEO' as const,
        cfStreamUploadUrl: streamUpload.uploadUrl,
        cfStreamUid: streamUpload.uid,
        expiresAt: expiresAt.toISOString(),
        chunkSizeBytes: 6 * 1024 * 1024,
      };
    }

    const ext = extensionForVideoMime(
      dto.originalName,
      dto.mimeType.toLowerCase(),
    );
    const objectPath = `organizations/${service.organization_id}/services/${serviceId}/attachments/${uploadId}/${randomUUID()}.${ext}`;
    const signedIntent =
      await this.storageService.createSignedUploadIntent(objectPath);
    const ttlMinutes = Number(
      this.configService.get<string>(
        'SERVICE_UPLOAD_INTENT_TTL_MINUTES',
        '1440',
      ),
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.$transaction(
      async (tx) => {
        await this.assertQuotaAndReserve(
          tx,
          service.organization_id,
          declaredSize,
          policy,
        );
        await tx.fileUpload.create({
          data: {
            id: uploadId,
            organization_id: service.organization_id,
            service_id: serviceId,
            created_by_user_id: user.id,
            storage_ref: signedIntent.storageRef,
            original_name: dto.originalName,
            declared_mime_type: dto.mimeType.toLowerCase(),
            declared_size_bytes: declaredSize,
            media_type: 'VIDEO',
            signed_token_hash: hashToken(signedIntent.signedUploadToken),
            expires_at: expiresAt,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    this.logger.log(
      JSON.stringify({
        event: 'upload_intent_created',
        uploadId,
        serviceId,
        organizationId: service.organization_id,
        userId: user.id,
        sizeBytes: String(declaredSize),
        mimeType: dto.mimeType,
        useCfStream: false,
      }),
    );

    await this.refreshServiceAttachmentSnapshot(serviceId);
    this.emitAttachmentsUpdated(serviceId, service.organization_id, user.id);

    return {
      uploadId,
      bucket: signedIntent.bucket,
      objectPath: signedIntent.objectPath,
      signedUploadToken: signedIntent.signedUploadToken,
      tusEndpoint: signedIntent.tusEndpoint,
      expiresAt: expiresAt.toISOString(),
      chunkSizeBytes: 6 * 1024 * 1024,
    };
  }

  async markStarted(serviceId: string, uploadId: string, user: any) {
    this.assertInternalUser(user);
    await this.assertServiceAccess(serviceId, user);
    const upload = await this.findUpload(serviceId, uploadId, user);
    if (upload.status === 'PENDING') {
      await this.prisma.fileUpload.update({
        where: { id: uploadId },
        data: { status: 'UPLOADING', upload_started_at: new Date() },
      });
      this.logger.log(
        JSON.stringify({
          event: 'upload_started',
          uploadId,
          serviceId,
          organizationId: upload.organization_id,
          userId: user.id,
          cfStreamUid: upload.cf_stream_uid ?? null,
        }),
      );
      await this.refreshServiceAttachmentSnapshot(serviceId);
      this.emitAttachmentsUpdated(serviceId, upload.organization_id, user.id);
    }
    return { ok: true };
  }

  async confirm(serviceId: string, uploadId: string, user: any) {
    this.assertInternalUser(user);
    const service = await this.assertServiceAccess(serviceId, user);
    const upload = await this.findUpload(serviceId, uploadId, user);

    const existingAttachment = await this.findConfirmedAttachment(
      upload.storage_ref,
    );
    if (existingAttachment) {
      return this.serializeAttachment(existingAttachment);
    }

    // Para CF Stream el webhook puede haber confirmado el upload antes de que el
    // frontend llame a confirm(). StoredFile no se crea en ese path, así que
    // findConfirmedAttachment no lo encuentra. Buscamos directamente por upload_id.
    if (upload.cf_stream_uid) {
      const existingCfAttachment = await this.prisma.serviceAttachment.findUnique({
        where: { upload_id: uploadId },
      });
      if (existingCfAttachment) {
        return this.serializeAttachment(existingCfAttachment);
      }
    }

    if (!ACTIVE_UPLOAD_STATUSES.includes(upload.status as any)) {
      throw new BadRequestException(
        'La carga no esta en un estado confirmable',
      );
    }
    if (upload.expires_at.getTime() < Date.now()) {
      await this.expireUpload(upload);
      throw new BadRequestException('La intencion de carga expiro');
    }

    if (upload.cf_stream_uid) {
      return this.confirmCfStream(serviceId, uploadId, upload, service, user);
    }

    const policy = await this.policyService.resolvePolicy(
      service.organization_id,
    );
    let verified: Awaited<
      ReturnType<UploadVerificationService['verifyUploadedObject']>
    >;
    try {
      verified = await this.verificationService.verifyUploadedObject(
        upload,
        policy,
      );
    } catch (error) {
      await this.failUploadAndDeleteObject(
        upload,
        error instanceof Error ? error.message : 'verification_failed',
      );
      throw error;
    }

    let attachment: any;
    try {
      attachment = await this.prisma.$transaction(
        async (tx) => {
          const storedFile = await tx.storedFile.create({
            data: {
              organization_id: service.organization_id,
              storage_ref: upload.storage_ref,
              original_name: upload.original_name,
              mime_type: verified.detectedMime,
              size_bytes: Number(verified.actualSize),
              kind: 'SERVICE_ATTACHMENT',
              visibility: 'PRIVATE',
              entity_type: 'SERVICE',
              entity_id: serviceId,
              uploaded_by_user_id: user.id,
            },
          });

          const createdAttachment = await tx.serviceAttachment.create({
            data: {
              service_id: serviceId,
              upload_id: uploadId,
              file_id: storedFile.id,
              file_type: verified.detectedMime,
              file_name: upload.original_name,
              file_size_bytes: Number(verified.actualSize),
              media_type: 'VIDEO',
            },
          });

          await tx.fileUpload.update({
            where: { id: uploadId },
            data: {
              status: 'CONFIRMED',
              detected_mime_type: verified.detectedMime,
              actual_size_bytes: verified.actualSize,
              upload_completed_at: new Date(),
              confirmed_at: new Date(),
              local_progress: 100,
            },
          });
          await this.moveReservationToReady(
            tx,
            service.organization_id,
            upload.declared_size_bytes,
            verified.actualSize,
          );
          return createdAttachment;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existing = await this.findConfirmedAttachment(upload.storage_ref);
        if (existing) {
          return this.serializeAttachment(existing);
        }
      }
      throw error;
    }

    await this.refreshServiceAttachmentSnapshot(serviceId);
    this.emitAttachmentsUpdated(serviceId, service.organization_id, user.id);
    return this.serializeAttachment(attachment);
  }

  private async confirmCfStream(
    serviceId: string,
    uploadId: string,
    upload: any,
    service: any,
    user: any,
  ) {
    const streamStatus = await this.cloudflareService.getStreamStatus(upload.cf_stream_uid);

    this.logger.log(
      JSON.stringify({
        event: 'cf_stream_status_polled',
        uploadId,
        uid: upload.cf_stream_uid,
        status: streamStatus.status,
        readyToStream: streamStatus.readyToStream,
      }),
    );

    if (!streamStatus.readyToStream) {
      await this.prisma.fileUpload.update({
        where: { id: uploadId },
        data: { cf_stream_status: streamStatus.status },
      });
      return {
        status: 'PROCESSING',
        message: 'El video está siendo procesado. Vuelve a intentar en unos segundos.',
        cfStreamUid: upload.cf_stream_uid,
      };
    }

    const actualSize = upload.declared_size_bytes;
    let attachment: any;
    try {
      attachment = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.serviceAttachment.create({
            data: {
              service_id: serviceId,
              upload_id: uploadId,
              file_type: upload.declared_mime_type,
              file_name: upload.original_name,
              file_size_bytes: Number(actualSize),
              media_type: 'VIDEO',
              duration_seconds: streamStatus.duration ? Math.round(streamStatus.duration) : null,
            },
          });

          await tx.fileUpload.update({
            where: { id: uploadId },
            data: {
              status: 'CONFIRMED',
              cf_stream_status: streamStatus.status,
              cf_stream_ready_to_stream: true,
              cf_stream_duration: streamStatus.duration,
              cf_stream_thumbnail: streamStatus.thumbnail,
              confirmed_at: new Date(),
              upload_completed_at: new Date(),
              local_progress: 100,
            },
          });

          await this.moveReservationToReady(tx, service.organization_id, actualSize, actualSize);
          return created;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: any) {
      // El webhook puede haber creado el ServiceAttachment concurrentemente.
      if (error?.code === 'P2002') {
        const existing = await this.prisma.serviceAttachment.findUnique({
          where: { upload_id: uploadId },
        });
        if (existing) return this.serializeAttachment(existing);
      }
      throw error;
    }

    await this.refreshServiceAttachmentSnapshot(serviceId);
    this.emitAttachmentsUpdated(serviceId, service.organization_id, user.id);
    return this.serializeAttachment(attachment);
  }

  async cancel(serviceId: string, uploadId: string, user: any) {
    this.assertInternalUser(user);
    await this.assertServiceAccess(serviceId, user);
    const upload = await this.findUpload(serviceId, uploadId, user);
    if (upload.status === 'CANCELLED' || upload.status === 'CONFIRMED') {
      return { ok: true };
    }

    if (upload.cf_stream_uid) {
      try {
        await this.cloudflareService.deleteStreamVideo(upload.cf_stream_uid);
      } catch (e: any) {
        this.logger.warn(`No se pudo eliminar video CF Stream ${upload.cf_stream_uid}: ${e.message}`);
      }
    } else {
      await this.storageService.deleteFile(upload.storage_ref);
    }
    await this.prisma.$transaction(
      async (tx) => {
        await tx.fileUpload.update({
          where: { id: uploadId },
          data: { status: 'CANCELLED', failure_reason: 'cancelled_by_user' },
        });
        if (ACTIVE_UPLOAD_STATUSES.includes(upload.status as any)) {
          await this.releaseReservation(
            tx,
            upload.organization_id,
            upload.declared_size_bytes,
            1,
          );
        }
      },
      { isolationLevel: 'Serializable' },
    );

    await this.refreshServiceAttachmentSnapshot(serviceId);
    this.emitAttachmentsUpdated(serviceId, upload.organization_id, user.id);
    return { ok: true };
  }

  async getPlaybackUrl(serviceId: string, attachmentId: string, user: any) {
    const service = await this.assertServiceAccess(serviceId, user, true);
    const attachment = await this.prisma.serviceAttachment.findFirst({
      where: {
        id: attachmentId,
        service_id: serviceId,
        media_type: 'VIDEO',
      },
      include: { file: true, upload: true },
    });

    if (!attachment) {
      throw new NotFoundException('Video no disponible');
    }

    this.logger.log(
      JSON.stringify({
        event: 'upload_playback_url_requested',
        serviceId,
        attachmentId,
        organizationId: service.organization_id,
        userId: user.id,
        role: user.role,
      }),
    );

    if (attachment.upload?.cf_stream_uid && attachment.upload.cf_stream_ready_to_stream) {
      const uid = attachment.upload.cf_stream_uid;
      const ttl = Number(
        this.configService.get<string>('CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS', '3600'),
      );
      const signedUrls = this.configService.get('CLOUDFLARE_STREAM_SIGNED_URLS') === 'true';

      this.logger.log(
        JSON.stringify({
          event: 'cf_stream_playback_url_built',
          uid,
          signedUrls,
          attachmentId,
        }),
      );

      if (signedUrls) {
        const token = await this.cloudflareService.getStreamSignedToken(uid, ttl);
        return {
          embedUrl: this.cloudflareService.getStreamEmbedUrl(token),
          hlsUrl: this.cloudflareService.getStreamHlsUrl(token),
          cfStreamUid: uid,
          duration: attachment.upload.cf_stream_duration,
          thumbnail: attachment.upload.cf_stream_thumbnail,
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        };
      }

      return {
        embedUrl: this.cloudflareService.getStreamEmbedUrl(uid),
        hlsUrl: this.cloudflareService.getStreamHlsUrl(uid),
        cfStreamUid: uid,
        duration: attachment.upload.cf_stream_duration,
        thumbnail: attachment.upload.cf_stream_thumbnail,
      };
    }

    if (!attachment.file || attachment.file.status !== 'READY') {
      throw new NotFoundException('Video no disponible');
    }

    const ttl = Number(
      this.configService.get<string>(
        'SERVICE_MEDIA_SIGNED_URL_TTL_SECONDS',
        '600',
      ),
    );
    const url = await this.storageService.resolveFileUrlWithTtl(
      attachment.file.storage_ref,
      ttl,
    );
    return {
      url,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  async getMine(user: any, status?: string) {
    this.assertInternalUser(user);
    const uploads = await this.prisma.fileUpload.findMany({
      where: {
        organization_id: user.orgId,
        created_by_user_id: user.id,
        ...(status === 'pending'
          ? { status: { in: [...ACTIVE_UPLOAD_STATUSES] } }
          : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    return uploads.map((upload) => this.serializeUpload(upload));
  }

  async updateProgress(
    serviceId: string,
    uploadId: string,
    body: any,
    user: any,
  ) {
    this.assertInternalUser(user);
    await this.assertServiceAccess(serviceId, user);
    const upload = await this.findUpload(serviceId, uploadId, user);
    const progress = Math.max(0, Math.min(100, Number(body?.progress ?? 0)));
    const status = ['PENDING', 'UPLOADING', 'UPLOADED', 'FAILED'].includes(
      body?.status,
    )
      ? body.status
      : undefined;

    if (
      status === 'FAILED' &&
      ACTIVE_UPLOAD_STATUSES.includes(upload.status as any)
    ) {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.fileUpload.update({
            where: { id: uploadId },
            data: {
              status: 'FAILED',
              local_progress: Math.round(progress),
              failure_reason: body?.failureReason ?? 'upload_failed',
            },
          });
          await this.releaseReservation(
            tx,
            upload.organization_id,
            upload.declared_size_bytes,
            1,
          );
        },
        { isolationLevel: 'Serializable' },
      );
    } else {
      await this.prisma.fileUpload.update({
        where: { id: uploadId },
        data: {
          local_progress: Math.round(progress),
          ...(status ? { status } : {}),
          ...(status === 'UPLOADED'
            ? { upload_completed_at: new Date() }
            : {}),
        },
      });
    }
    await this.refreshServiceAttachmentSnapshot(serviceId);
    this.emitAttachmentsUpdated(serviceId, upload.organization_id, user.id);
    return { ok: true };
  }

  async retry(serviceId: string, uploadId: string, user: any) {
    this.assertInternalUser(user);
    const service = await this.assertServiceAccess(serviceId, user);
    const upload = await this.findUpload(serviceId, uploadId, user);
    if (upload.status === 'CONFIRMED') {
      throw new BadRequestException('La carga ya fue confirmada');
    }

    if (upload.cf_stream_uid) {
      if (upload.cf_stream_uid) {
        try {
          await this.cloudflareService.deleteStreamVideo(upload.cf_stream_uid);
        } catch {}
      }

      const streamUpload = await this.cloudflareService.createStreamDirectUpload({
        maxDurationSeconds: 600,
        uploadLengthBytes: Number(upload.declared_size_bytes),
        organizationId: service.organization_id,
        serviceId,
        uploadId,
      });
      const expiresAt = new Date(streamUpload.expiresAt);
      await this.prisma.fileUpload.update({
        where: { id: uploadId },
        data: {
          status: 'PENDING',
          storage_ref: `cf-stream://${streamUpload.uid}`,
          cf_stream_uid: streamUpload.uid,
          cf_stream_upload_url: streamUpload.uploadUrl,
          cf_stream_status: 'pendingupload',
          cf_stream_ready_to_stream: false,
          cf_stream_duration: null,
          cf_stream_thumbnail: null,
          expires_at: expiresAt,
          failure_reason: null,
        },
      });
      await this.refreshServiceAttachmentSnapshot(serviceId);
      this.emitAttachmentsUpdated(serviceId, service.organization_id, user.id);
      return {
        uploadId,
        mediaType: 'VIDEO' as const,
        cfStreamUploadUrl: streamUpload.uploadUrl,
        cfStreamUid: streamUpload.uid,
        expiresAt: expiresAt.toISOString(),
        chunkSizeBytes: 6 * 1024 * 1024,
      };
    }

    const objectPath = upload.storage_ref.split('/').slice(3).join('/');
    const signedIntent =
      await this.storageService.createSignedUploadIntent(objectPath);
    const ttlMinutes = Number(
      this.configService.get<string>(
        'SERVICE_UPLOAD_INTENT_TTL_MINUTES',
        '1440',
      ),
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await this.prisma.fileUpload.update({
      where: { id: uploadId },
      data: {
        status: 'PENDING',
        signed_token_hash: hashToken(signedIntent.signedUploadToken),
        expires_at: expiresAt,
        failure_reason: null,
      },
    });
    await this.refreshServiceAttachmentSnapshot(serviceId);
    this.emitAttachmentsUpdated(serviceId, upload.organization_id, user.id);
    return {
      uploadId,
      bucket: signedIntent.bucket,
      objectPath: signedIntent.objectPath,
      signedUploadToken: signedIntent.signedUploadToken,
      tusEndpoint: signedIntent.tusEndpoint,
      expiresAt: expiresAt.toISOString(),
      chunkSizeBytes: 6 * 1024 * 1024,
    };
  }

  async finalizeWithFailures(serviceId: string, user: any) {
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo un Admin puede finalizar con fallos');
    }
    const service = await this.assertServiceAccess(serviceId, user);
    const pending = await this.prisma.fileUpload.findMany({
      where: {
        service_id: serviceId,
        organization_id: service.organization_id,
        status: { in: [...ACTIVE_UPLOAD_STATUSES, ...FAILED_UPLOAD_STATUSES] },
      },
    });
    await this.prisma.$transaction(
      async (tx) => {
        for (const upload of pending) {
          if (ACTIVE_UPLOAD_STATUSES.includes(upload.status as any)) {
            await this.releaseReservation(
              tx,
              service.organization_id,
              upload.declared_size_bytes,
              1,
            );
          }
          await tx.fileUpload.update({
            where: { id: upload.id },
            data: {
              status: 'CANCELLED',
              failure_reason: upload.failure_reason ?? 'finalized_by_admin',
            },
          });
        }
      },
      { isolationLevel: 'Serializable' },
    );
    await this.refreshServiceAttachmentSnapshot(serviceId);
    this.emitAttachmentsUpdated(serviceId, service.organization_id, user.id);
    return { ok: true };
  }

  async refreshServiceAttachmentSnapshot(serviceId: string) {
    const [uploads, attachmentSum, attachmentCount] = await Promise.all([
      this.prisma.fileUpload.findMany({
        where: { service_id: serviceId },
        select: {
          status: true,
          declared_size_bytes: true,
          actual_size_bytes: true,
        },
      }),
      this.prisma.serviceAttachment.aggregate({
        where: { service_id: serviceId },
        _sum: { file_size_bytes: true },
      }),
      this.prisma.serviceAttachment.count({ where: { service_id: serviceId } }),
    ]);

    const active = uploads.filter((upload) =>
      ACTIVE_UPLOAD_STATUSES.includes(upload.status as any),
    );
    const failed = uploads.filter((upload) =>
      FAILED_UPLOAD_STATUSES.includes(upload.status as any),
    );
    const nonConfirmedUploads = uploads.filter(
      (upload) => upload.status !== 'CONFIRMED',
    );
    const ready = attachmentCount;
    const expected = attachmentCount + nonConfirmedUploads.length;
    const bytesTotal =
      nonConfirmedUploads.reduce(
        (sum, item) => sum + item.declared_size_bytes,
        0n,
      ) + BigInt(attachmentSum._sum.file_size_bytes ?? 0);
    const bytesReady = BigInt(attachmentSum._sum.file_size_bytes ?? 0);

    let status: 'NONE' | 'UPLOADING' | 'PARTIALLY_READY' | 'READY' | 'FAILED' =
      'NONE';
    if (active.length > 0 && ready === 0) status = 'UPLOADING';
    else if (active.length > 0 && ready > 0) status = 'PARTIALLY_READY';
    else if (active.length === 0 && failed.length > 0 && ready > 0)
      status = 'PARTIALLY_READY';
    else if (active.length === 0 && failed.length > 0 && ready === 0)
      status = 'FAILED';
    else if (active.length === 0 && failed.length === 0 && expected > 0)
      status = 'READY';

    await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        attachment_upload_status: status,
        pending_attachment_count: active.length,
        failed_attachment_count: failed.length,
        ready_attachment_count: ready,
        attachment_bytes_total: bytesTotal,
        attachment_bytes_ready: bytesReady,
      },
    });
  }

  async markStreamReady(
    uploadId: string,
    data: { duration: number | null; thumbnail: string | null },
  ) {
    const upload = await this.prisma.fileUpload.findUnique({
      where: { id: uploadId },
    });
    if (!upload || upload.status === 'CONFIRMED') return;

    const attachment = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.serviceAttachment.create({
          data: {
            service_id: upload.service_id,
            upload_id: upload.id,
            file_type: upload.declared_mime_type,
            file_name: upload.original_name,
            file_size_bytes: Number(upload.declared_size_bytes),
            media_type: 'VIDEO',
            duration_seconds: data.duration ? Math.round(data.duration) : null,
          },
        });

        await tx.fileUpload.update({
          where: { id: uploadId },
          data: {
            status: 'CONFIRMED',
            cf_stream_status: 'ready',
            cf_stream_ready_to_stream: true,
            cf_stream_duration: data.duration,
            cf_stream_thumbnail: data.thumbnail,
            confirmed_at: new Date(),
            upload_completed_at: new Date(),
            local_progress: 100,
          },
        });

        await this.moveReservationToReady(
          tx,
          upload.organization_id,
          upload.declared_size_bytes,
          upload.declared_size_bytes,
        );

        return created;
      },
      { isolationLevel: 'Serializable' },
    );

    await this.refreshServiceAttachmentSnapshot(upload.service_id);
    this.emitAttachmentsUpdated(upload.service_id, upload.organization_id, null);
    this.logger.log(`CF Stream ready: upload ${uploadId}, stream ${upload.cf_stream_uid}`);
    return attachment;
  }

  async markStreamFailed(uploadId: string, reason: string) {
    const upload = await this.prisma.fileUpload.findUnique({
      where: { id: uploadId },
    });
    if (!upload || upload.status === 'CONFIRMED') return;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.fileUpload.update({
          where: { id: uploadId },
          data: {
            status: 'FAILED',
            cf_stream_status: 'error',
            failure_reason: reason,
          },
        });
        if (ACTIVE_UPLOAD_STATUSES.includes(upload.status as any)) {
          await this.releaseReservation(
            tx,
            upload.organization_id,
            upload.declared_size_bytes,
            1,
          );
        }
      },
      { isolationLevel: 'Serializable' },
    );

    await this.refreshServiceAttachmentSnapshot(upload.service_id);
    this.emitAttachmentsUpdated(upload.service_id, upload.organization_id, null);
    this.logger.warn(`CF Stream failed: upload ${uploadId}, reason: ${reason}`);
  }

  private async assertServiceAccess(
    serviceId: string,
    user: any,
    allowExternal = false,
  ) {
    if (!allowExternal) {
      this.assertInternalUser(user);
    }
    const where: any = { id: serviceId, deleted_at: null, purged_at: null };
    if (user.role !== 'SUPER_ADMIN') {
      where.organization_id = user.orgId;
    }
    const service = await this.prisma.service.findFirst({
      where,
      include: { asset: { select: { owner_id: true } } },
    });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }
    if (user.role === 'EXTERNAL') {
      if (
        !allowExternal ||
        !service.is_public ||
        !user.owner_id ||
        service.asset.owner_id !== user.owner_id
      ) {
        throw new NotFoundException('Servicio no encontrado');
      }
    }
    return service;
  }

  private assertInternalUser(user: any) {
    if (!['SUPER_ADMIN', 'ADMIN', 'WORKER'].includes(user.role)) {
      throw new ForbiddenException('No tienes permiso para gestionar adjuntos');
    }
  }

  private async findUpload(serviceId: string, uploadId: string, user: any) {
    const upload = await this.prisma.fileUpload.findFirst({
      where: {
        id: uploadId,
        service_id: serviceId,
        ...(user.role === 'SUPER_ADMIN' ? {} : { organization_id: user.orgId }),
        ...(user.role === 'WORKER' ? { created_by_user_id: user.id } : {}),
      },
    });
    if (!upload) {
      throw new NotFoundException('Carga no encontrada');
    }
    return upload;
  }

  private async findConfirmedAttachment(storageRef: string) {
    const storedFile = await this.prisma.storedFile.findUnique({
      where: { storage_ref: storageRef },
      include: { service_attachment: true },
    });
    return storedFile?.service_attachment ?? null;
  }

  private async expireUpload(upload: any) {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.fileUpload.update({
          where: { id: upload.id },
          data: { status: 'EXPIRED', failure_reason: 'intent_expired' },
        });
        await this.releaseReservation(
          tx,
          upload.organization_id,
          BigInt(upload.declared_size_bytes),
          1,
        );
      },
      { isolationLevel: 'Serializable' },
    );
    await this.refreshServiceAttachmentSnapshot(upload.service_id);
    this.emitAttachmentsUpdated(
      upload.service_id,
      upload.organization_id,
      null,
    );
  }

  private async failUploadAndDeleteObject(upload: any, reason: string) {
    await this.storageService.deleteFile(upload.storage_ref);
    await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.fileUpload.updateMany({
          where: { id: upload.id, status: { in: [...ACTIVE_UPLOAD_STATUSES] } },
          data: { status: 'FAILED', failure_reason: reason },
        });
        if (updated.count > 0) {
          await this.releaseReservation(
            tx,
            upload.organization_id,
            upload.declared_size_bytes,
            1,
          );
        }
      },
      { isolationLevel: 'Serializable' },
    );
    await this.refreshServiceAttachmentSnapshot(upload.service_id);
    this.emitAttachmentsUpdated(
      upload.service_id,
      upload.organization_id,
      null,
    );
    this.logger.warn(
      JSON.stringify({
        event: 'upload_verification_failed',
        uploadId: upload.id,
        serviceId: upload.service_id,
        organizationId: upload.organization_id,
        reason,
      }),
    );
  }

  private async assertQuotaAndReserve(
    tx: any,
    organizationId: string,
    incomingBytes: bigint,
    policy: any,
  ) {
    const [{ _sum: readySum }, { _sum: reservedSum }] = await Promise.all([
      tx.storedFile.aggregate({
        where: { organization_id: organizationId, status: 'READY' },
        _sum: { size_bytes: true },
      }),
      tx.fileUpload.aggregate({
        where: {
          organization_id: organizationId,
          status: { in: [...ACTIVE_UPLOAD_STATUSES] },
        },
        _sum: { declared_size_bytes: true },
      }),
    ]);

    const readyBytes = BigInt(readySum.size_bytes ?? 0);
    const reservedBytes = reservedSum.declared_size_bytes ?? 0n;
    const projectedBytes = readyBytes + reservedBytes + incomingBytes;
    if (policy.quotaBytes > 0n && projectedBytes > policy.quotaBytes) {
      this.logger.warn(
        JSON.stringify({
          event: 'storage_quota_exceeded',
          context: 'assertQuotaAndReserve',
          organizationId,
          incomingBytes: String(incomingBytes),
          readyBytes: String(readyBytes),
          reservedBytes: String(reservedBytes),
          projectedBytes: String(projectedBytes),
          quotaBytes: String(policy.quotaBytes),
        }),
      );
      throw new BadRequestException(
        'No hay almacenamiento disponible para este archivo',
      );
    }

    await tx.organizationStorageUsage.upsert({
      where: { organization_id: organizationId },
      create: {
        organization_id: organizationId,
        ready_bytes: readyBytes,
        reserved_bytes: reservedBytes + incomingBytes,
        ready_file_count: 0,
        pending_upload_count: 1,
      },
      update: {
        reserved_bytes: { increment: incomingBytes },
        pending_upload_count: { increment: 1 },
      },
    });
  }

  private async releaseReservation(
    tx: any,
    organizationId: string,
    bytes: bigint,
    count: number,
  ) {
    await tx.$executeRaw`
      INSERT INTO "OrganizationStorageUsage" ("organization_id", "ready_bytes", "reserved_bytes", "ready_file_count", "pending_upload_count", "updated_at")
      VALUES (${organizationId}, 0, 0, 0, 0, NOW())
      ON CONFLICT ("organization_id") DO UPDATE
        SET "reserved_bytes" = GREATEST("OrganizationStorageUsage"."reserved_bytes" - ${bytes}, 0),
            "pending_upload_count" = GREATEST("OrganizationStorageUsage"."pending_upload_count" - ${count}, 0),
            "updated_at" = NOW()
    `;
  }

  private async moveReservationToReady(
    tx: any,
    organizationId: string,
    declaredBytes: bigint,
    actualBytes: bigint,
  ) {
    await tx.$executeRaw`
      INSERT INTO "OrganizationStorageUsage" ("organization_id", "ready_bytes", "reserved_bytes", "ready_file_count", "pending_upload_count", "updated_at")
      VALUES (${organizationId}, ${actualBytes}, 0, 1, 0, NOW())
      ON CONFLICT ("organization_id") DO UPDATE
        SET "reserved_bytes" = GREATEST("OrganizationStorageUsage"."reserved_bytes" - ${declaredBytes}, 0),
            "ready_bytes" = "OrganizationStorageUsage"."ready_bytes" + ${actualBytes},
            "ready_file_count" = "OrganizationStorageUsage"."ready_file_count" + 1,
            "pending_upload_count" = GREATEST("OrganizationStorageUsage"."pending_upload_count" - 1, 0),
            "updated_at" = NOW()
    `;
  }

  private serializeAttachment(attachment: any) {
    return {
      ...attachment,
      file_size_bytes: attachment.file_size_bytes ?? null,
      status: 'READY',
      mediaType: attachment.media_type,
    };
  }

  private emitAttachmentsUpdated(
    serviceId: string,
    organizationId: string,
    actorUserId?: string | null,
  ) {
    this.realtimeService?.emit({
      module: 'services',
      action: 'updated',
      entityId: serviceId,
      organizationId,
      actorUserId,
    });
  }

  private serializeUpload(upload: any) {
    return {
      id: upload.id,
      serviceId: upload.service_id,
      originalName: upload.original_name,
      declaredMimeType: upload.declared_mime_type,
      declaredSizeBytes: toStringBytes(upload.declared_size_bytes),
      actualSizeBytes:
        upload.actual_size_bytes == null
          ? null
          : toStringBytes(upload.actual_size_bytes),
      mediaType: upload.media_type,
      status: upload.status,
      progress: upload.local_progress,
      expiresAt: upload.expires_at.toISOString(),
      failureReason: upload.failure_reason,
    };
  }
}
