import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { createHmac, timingSafeEqual } from 'crypto';

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
    @Body() body: any,
    @Headers('webhook-signature') signature: string,
  ) {
    const secret = this.configService.get<string>('CLOUDFLARE_STREAM_WEBHOOK_SECRET');
    if (secret && signature) {
      this.verifySignature(signature, JSON.stringify(body), secret);
    }

    const uid = body?.uid;
    const state = body?.status?.state;

    if (!uid || !state) {
      this.logger.warn('CF Stream webhook: missing uid or status.state');
      return { ok: true };
    }

    this.logger.log(`CF Stream webhook: uid=${uid} state=${state}`);

    const upload = await this.prisma.fileUpload.findFirst({
      where: { cf_stream_uid: uid },
    });

    if (!upload) {
      this.logger.warn(`CF Stream webhook: no upload found for uid ${uid}`);
      return { ok: true };
    }

    if (state === 'ready') {
      await this.uploadsService.markStreamReady(upload.id, {
        duration: body.duration ?? null,
        thumbnail: body.thumbnail ?? null,
      });
    } else if (state === 'error') {
      await this.uploadsService.markStreamFailed(
        upload.id,
        'cloudflare_processing_error',
      );
    }

    return { ok: true };
  }

  private verifySignature(
    signatureHeader: string,
    payload: string,
    secret: string,
  ) {
    try {
      const parts = signatureHeader.split(',');
      const timestampPart = parts.find((p) => p.startsWith('time='));
      const sigPart = parts.find((p) => p.startsWith('sig1='));

      if (!timestampPart || !sigPart) {
        throw new ForbiddenException('Invalid webhook signature format');
      }

      const timestamp = timestampPart.split('=')[1];
      const receivedSig = sigPart.split('=')[1];
      const message = `${timestamp}.${payload}`;
      const expectedSig = createHmac('sha256', secret)
        .update(message)
        .digest('hex');

      const a = Buffer.from(receivedSig, 'hex');
      const b = Buffer.from(expectedSig, 'hex');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new ForbiddenException('Invalid webhook signature');
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new ForbiddenException('Invalid webhook signature');
    }
  }
}
