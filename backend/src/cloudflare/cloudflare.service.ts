import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface StreamDirectUploadResponse {
  uid: string;
  uploadUrl: string;
  expiresAt: string;
}

interface StreamStatusResponse {
  status: 'pendingupload' | 'uploading' | 'ready' | 'error';
  readyToStream: boolean;
  duration: number | null;
  thumbnail: string | null;
}

interface ImageUploadResponse {
  id: string;
  variants: string[];
}

interface CloudflareApiError {
  message?: string;
}

interface CloudflareApiResponse<T> {
  success?: boolean;
  errors?: CloudflareApiError[];
  result: T;
}

interface CloudflareStreamResult {
  status?: { state?: StreamStatusResponse['status'] };
  readyToStream?: boolean;
  duration?: number | null;
  thumbnail?: string | null;
}

interface CloudflareTokenResult {
  token: string;
}

interface CloudflareImageResult {
  id: string;
  variants?: string[];
}

function encodeTusMetadataValue(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

function buildTusMetadata(meta: Record<string, string>): string {
  return Object.entries(meta)
    .filter(([, v]) => v !== '')
    .map(([key, value]) => `${key} ${encodeTusMetadataValue(value)}`)
    .join(',');
}

@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly streamSubdomain: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const streamEnabled =
      this.configService.get<string>('CLOUDFLARE_STREAM_ENABLED') === 'true';
    this.accountId =
      this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID') ?? '';
    this.apiToken =
      this.configService.get<string>('CLOUDFLARE_API_TOKEN') ?? '';
    this.streamSubdomain =
      this.configService.get<string>('CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN') ??
      '';
    if (
      isProduction &&
      streamEnabled &&
      (!this.accountId || !this.apiToken || !this.streamSubdomain)
    ) {
      throw new Error(
        'Cloudflare Stream is enabled but required production configuration is missing',
      );
    }
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}`;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
    };
  }

  async createStreamDirectUpload(opts: {
    maxDurationSeconds: number;
    uploadLengthBytes: number;
    organizationId: string;
    serviceId: string;
    uploadId: string;
  }): Promise<StreamDirectUploadResponse> {
    const ttl = this.resolveStreamTtlSeconds();
    const expiry = new Date(Date.now() + ttl * 1000).toISOString();
    const requireSigned =
      this.configService.get('CLOUDFLARE_STREAM_SIGNED_URLS') === 'true';

    const metadata = buildTusMetadata({
      name: opts.uploadId,
      maxDurationSeconds: String(opts.maxDurationSeconds),
      expiry,
      requiresignedurls: requireSigned ? 'true' : '',
    });

    const res = await fetch(`${this.baseUrl}/stream?direct_user=true`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(opts.uploadLengthBytes),
        'Upload-Metadata': metadata,
      },
    });

    if (res.status !== 201) {
      const body = await res.text();
      this.logger.error(
        JSON.stringify({
          event: 'cf_tus_creation_failed',
          status: res.status,
          body: body.substring(0, 500),
        }),
      );
      throw new Error(`Cloudflare TUS creation failed: HTTP ${res.status}`);
    }

    const location = res.headers.get('location');
    const streamMediaId = res.headers.get('stream-media-id');

    if (!location || !streamMediaId) {
      throw new Error(
        'Cloudflare TUS creation response missing Location or stream-media-id header',
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'cf_tus_session_created',
        uid: streamMediaId,
        uploadId: opts.uploadId,
        uploadLengthBytes: opts.uploadLengthBytes,
      }),
    );

    return {
      uid: streamMediaId,
      uploadUrl: location,
      expiresAt: expiry,
    };
  }

  async getStreamStatus(uid: string): Promise<StreamStatusResponse> {
    const res = await fetch(`${this.baseUrl}/stream/${uid}`, {
      headers: this.headers(),
    });

    const data =
      (await res.json()) as CloudflareApiResponse<CloudflareStreamResult>;
    if (!data.success) {
      throw new Error(
        `CF Stream status error: ${data.errors?.[0]?.message ?? 'unknown'}`,
      );
    }

    const video = data.result;
    return {
      status: video.status?.state ?? 'error',
      readyToStream: video.readyToStream === true,
      duration: video.duration ?? null,
      thumbnail: video.thumbnail
        ? `https://${this.streamSubdomain}/${uid}/thumbnails/thumbnail.jpg`
        : null,
    };
  }

  async getStreamSignedToken(uid: string, ttlSeconds: number): Promise<string> {
    const res = await fetch(`${this.baseUrl}/stream/${uid}/token`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
      }),
    });

    const data =
      (await res.json()) as CloudflareApiResponse<CloudflareTokenResult>;
    if (!data.success) {
      throw new Error(
        `CF Stream token error: ${data.errors?.[0]?.message ?? 'unknown'}`,
      );
    }

    return data.result.token;
  }

  async deleteStreamVideo(uid: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/stream/${uid}`, {
      method: 'DELETE',
      headers: this.headers(),
    });

    if (!res.ok && res.status !== 404) {
      this.logger.warn(`CF Stream delete failed for ${uid}: ${res.status}`);
    }
  }

  async uploadImage(opts: {
    buffer: Buffer;
    mimeType: string;
    organizationId: string;
    serviceId: string;
    attachmentId: string;
  }): Promise<ImageUploadResponse> {
    const formData = new FormData();
    const blob = new Blob([opts.buffer as unknown as ArrayBuffer], {
      type: opts.mimeType,
    });
    formData.append(
      'file',
      blob,
      `${opts.attachmentId}.${opts.mimeType.split('/')[1] || 'jpg'}`,
    );
    formData.append(
      'metadata',
      JSON.stringify({
        organizationId: opts.organizationId,
        serviceId: opts.serviceId,
        attachmentId: opts.attachmentId,
      }),
    );

    const res = await fetch(`${this.baseUrl}/images/v1`, {
      method: 'POST',
      headers: this.headers(),
      body: formData,
    });

    const data =
      (await res.json()) as CloudflareApiResponse<CloudflareImageResult>;
    if (!data.success) {
      this.logger.error(
        `CF Images upload failed: ${JSON.stringify(data.errors)}`,
      );
      throw new Error(
        `Cloudflare Images error: ${data.errors?.[0]?.message ?? 'unknown'}`,
      );
    }

    return {
      id: data.result.id,
      variants: data.result.variants ?? [],
    };
  }

  async deleteImage(imageId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/images/v1/${imageId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });

    if (!res.ok && res.status !== 404) {
      this.logger.warn(`CF Images delete failed for ${imageId}: ${res.status}`);
    }
  }

  getStreamEmbedUrl(uid: string): string {
    return `https://iframe.videodelivery.net/${uid}`;
  }

  getStreamHlsUrl(uidOrToken: string): string {
    return `https://${this.streamSubdomain}/${uidOrToken}/manifest/video.m3u8`;
  }

  getStreamThumbnailUrl(uid: string): string {
    return `https://${this.streamSubdomain}/${uid}/thumbnails/thumbnail.jpg`;
  }

  isConfigured(): boolean {
    return !!(this.accountId && this.apiToken);
  }

  private resolveStreamTtlSeconds(): number {
    const configured = this.configService.get<string>(
      'CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS',
    );
    if (
      this.configService.get<string>('NODE_ENV') === 'production' &&
      !configured
    ) {
      throw new Error(
        'CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS must be defined in production',
      );
    }
    const ttl = Number(configured ?? '3600');
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error('CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS is invalid');
    }
    return ttl;
  }
}
