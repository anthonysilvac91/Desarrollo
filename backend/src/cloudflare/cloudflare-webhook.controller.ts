import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

type RawBodyRequest = Request & { rawBody?: Buffer };

interface CloudflareStreamWebhookBody {
  uid?: unknown;
  status?: {
    state?: unknown;
  };
  duration?: unknown;
  thumbnail?: unknown;
}

@ApiTags('Webhooks')
@Controller('webhooks/cloudflare')
export class CloudflareWebhookController {
  private readonly logger = new Logger(CloudflareWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('stream')
  @ApiOperation({ summary: 'Webhook de Cloudflare Stream (video ready/error)' })
  async streamWebhook(
    @Body() body: CloudflareStreamWebhookBody,
    @Headers('webhook-signature') signature: string | undefined,
    @Req() req: RawBodyRequest,
  ) {
    const secret = this.configService.get<string>(
      'CLOUDFLARE_STREAM_WEBHOOK_SECRET',
    );
    if (!secret) {
      const message =
        'CF Stream webhook rejected: CLOUDFLARE_STREAM_WEBHOOK_SECRET is not configured';
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        this.logger.error(message);
      } else {
        this.logger.warn(message);
      }
      throw new ForbiddenException(
        'Webhook signature verification unavailable',
      );
    }

    this.verifySignature(signature, req.rawBody, secret);

    const uid = typeof body.uid === 'string' ? body.uid : null;
    const state =
      typeof body.status?.state === 'string' ? body.status.state : null;

    if (!uid || !state) {
      this.logger.warn(
        JSON.stringify({ event: 'cf_stream_webhook_invalid_payload' }),
      );
      return { ok: true };
    }

    this.logger.log(
      JSON.stringify({ event: 'cf_stream_webhook_received', uid, state }),
    );

    const upload = await this.prisma.fileUpload.findFirst({
      where: { cf_stream_uid: uid },
    });

    if (!upload) {
      this.logger.warn(
        JSON.stringify({
          event: 'cf_stream_webhook_upload_not_found',
          uid,
          state,
        }),
      );
      return { ok: true };
    }

    if (state === 'ready') {
      await this.uploadsService.markStreamReady(upload.id, {
        duration: typeof body.duration === 'number' ? body.duration : null,
        thumbnail: typeof body.thumbnail === 'string' ? body.thumbnail : null,
      });
    } else if (state === 'error') {
      await this.uploadsService.markStreamFailed(
        upload.id,
        'cloudflare_processing_error',
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'cf_stream_webhook_processed',
        uid,
        state,
        uploadId: upload.id,
        organizationId: upload.organization_id,
      }),
    );

    return { ok: true };
  }

  private verifySignature(
    signatureHeader: string | undefined,
    rawBody: Buffer | undefined,
    secret: string,
  ) {
    try {
      if (!signatureHeader || !rawBody) {
        throw new ForbiddenException('Invalid webhook signature');
      }

      const parts = signatureHeader.split(',');
      const timestampPart = parts.find((p) => p.trim().startsWith('time='));
      const sigPart = parts.find((p) => p.trim().startsWith('sig1='));

      if (!timestampPart || !sigPart) {
        throw new ForbiddenException('Invalid webhook signature format');
      }

      const timestamp = timestampPart.split('=')[1]?.trim();
      const receivedSig = sigPart.split('=')[1]?.trim();
      if (!timestamp || !receivedSig || !/^\d+$/.test(timestamp)) {
        throw new ForbiddenException('Invalid webhook signature format');
      }
      if (!/^[a-f0-9]{64}$/i.test(receivedSig)) {
        throw new ForbiddenException('Invalid webhook signature format');
      }

      const timestampSeconds = Number(timestamp);
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (
        !Number.isSafeInteger(timestampSeconds) ||
        Math.abs(nowSeconds - timestampSeconds) >
          WEBHOOK_SIGNATURE_TOLERANCE_SECONDS
      ) {
        throw new ForbiddenException('Invalid webhook signature timestamp');
      }

      const expectedSig = createHmac('sha256', secret)
        .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
        .digest('hex');

      const received = Buffer.from(receivedSig, 'hex');
      const expected = Buffer.from(expectedSig, 'hex');
      if (
        received.length !== expected.length ||
        !timingSafeEqual(received, expected)
      ) {
        throw new ForbiddenException('Invalid webhook signature');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ForbiddenException('Invalid webhook signature');
    }
  }
}
