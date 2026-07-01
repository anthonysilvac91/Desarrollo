import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { CloudflareWebhookController } from './cloudflare-webhook.controller';

function sign(rawBody: Buffer, secret: string, timestamp: number): string {
  const sig = createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
    .digest('hex');
  return `time=${timestamp},sig1=${sig}`;
}

describe('CloudflareWebhookController', () => {
  const secret = 'webhook-secret';
  const nowSeconds = 1_800_000_000;
  let prisma: { fileUpload: { findFirst: jest.Mock } };
  let uploadsService: {
    markStreamReady: jest.Mock;
    markStreamFailed: jest.Mock;
  };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(nowSeconds * 1000);
    prisma = {
      fileUpload: {
        findFirst: jest.fn(),
      },
    };
    uploadsService = {
      markStreamReady: jest.fn(),
      markStreamFailed: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function controller(env: Record<string, string | undefined> = {}) {
    return new CloudflareWebhookController(
      prisma as any,
      uploadsService as any,
      {
        get: jest.fn((key: string) => env[key]),
      } as unknown as ConfigService,
    );
  }

  it('rechaza en produccion si falta el secreto', async () => {
    const rawBody = Buffer.from('{"uid":"uid-1","status":{"state":"ready"}}');

    await expect(
      controller({ NODE_ENV: 'production' }).streamWebhook(
        JSON.parse(rawBody.toString()),
        sign(rawBody, secret, nowSeconds),
        { rawBody } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza firma ausente', async () => {
    const rawBody = Buffer.from('{"uid":"uid-1","status":{"state":"ready"}}');

    await expect(
      controller({ CLOUDFLARE_STREAM_WEBHOOK_SECRET: secret }).streamWebhook(
        JSON.parse(rawBody.toString()),
        undefined,
        { rawBody } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza firma invalida', async () => {
    const rawBody = Buffer.from('{"uid":"uid-1","status":{"state":"ready"}}');

    await expect(
      controller({ CLOUDFLARE_STREAM_WEBHOOK_SECRET: secret }).streamWebhook(
        JSON.parse(rawBody.toString()),
        `time=${nowSeconds},sig1=${'0'.repeat(64)}`,
        { rawBody } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza timestamp expirado', async () => {
    const rawBody = Buffer.from('{"uid":"uid-1","status":{"state":"ready"}}');
    const expired = nowSeconds - 301;

    await expect(
      controller({ CLOUDFLARE_STREAM_WEBHOOK_SECRET: secret }).streamWebhook(
        JSON.parse(rawBody.toString()),
        sign(rawBody, secret, expired),
        { rawBody } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza payload modificado despues de firmar', async () => {
    const signedBody = Buffer.from(
      '{"uid":"uid-1","status":{"state":"ready"}}',
    );
    const alteredBody = Buffer.from(
      '{"uid":"uid-1","status":{"state":"error"}}',
    );

    await expect(
      controller({ CLOUDFLARE_STREAM_WEBHOOK_SECRET: secret }).streamWebhook(
        JSON.parse(alteredBody.toString()),
        sign(signedBody, secret, nowSeconds),
        { rawBody: alteredBody } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('procesa evento ready con firma valida', async () => {
    const rawBody = Buffer.from(
      '{"uid":"uid-1","status":{"state":"ready"},"duration":12,"thumbnail":"thumb"}',
    );
    prisma.fileUpload.findFirst.mockResolvedValue({
      id: 'upload-1',
      organization_id: 'org-1',
    });

    await expect(
      controller({ CLOUDFLARE_STREAM_WEBHOOK_SECRET: secret }).streamWebhook(
        JSON.parse(rawBody.toString()),
        sign(rawBody, secret, nowSeconds),
        { rawBody } as any,
      ),
    ).resolves.toEqual({ ok: true });

    expect(uploadsService.markStreamReady).toHaveBeenCalledWith('upload-1', {
      duration: 12,
      thumbnail: 'thumb',
    });
  });

  it('procesa evento error con firma valida', async () => {
    const rawBody = Buffer.from('{"uid":"uid-1","status":{"state":"error"}}');
    prisma.fileUpload.findFirst.mockResolvedValue({
      id: 'upload-1',
      organization_id: 'org-1',
    });

    await expect(
      controller({ CLOUDFLARE_STREAM_WEBHOOK_SECRET: secret }).streamWebhook(
        JSON.parse(rawBody.toString()),
        sign(rawBody, secret, nowSeconds),
        { rawBody } as any,
      ),
    ).resolves.toEqual({ ok: true });

    expect(uploadsService.markStreamFailed).toHaveBeenCalledWith(
      'upload-1',
      'cloudflare_processing_error',
    );
  });
});
