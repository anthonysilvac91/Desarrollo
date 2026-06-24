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

@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly streamSubdomain: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID', '');
    this.apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN', '');
    this.streamSubdomain = this.configService.get<string>(
      'CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN',
      'customer-yrufylz27agxoaqz.cloudflarestream.com',
    );
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}`;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
    };
  }

  async createStreamDirectUpload(opts: {
    maxDurationSeconds: number;
    organizationId: string;
    serviceId: string;
    uploadId: string;
  }): Promise<StreamDirectUploadResponse> {
    const ttl = Number(
      this.configService.get<string>('CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS', '3600'),
    );
    const expiry = new Date(Date.now() + ttl * 1000).toISOString();

    const res = await fetch(`${this.baseUrl}/stream/direct_upload`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxDurationSeconds: opts.maxDurationSeconds,
        expiry,
        meta: {
          organizationId: opts.organizationId,
          serviceId: opts.serviceId,
          uploadId: opts.uploadId,
        },
        requireSignedURLs: this.configService.get('CLOUDFLARE_STREAM_SIGNED_URLS') === 'true',
      }),
    });

    const data = await res.json();
    if (!data.success) {
      this.logger.error(`CF Stream direct_upload failed: ${JSON.stringify(data.errors)}`);
      throw new Error(`Cloudflare Stream error: ${data.errors?.[0]?.message ?? 'unknown'}`);
    }

    return {
      uid: data.result.uid,
      uploadUrl: data.result.uploadURL,
      expiresAt: expiry,
    };
  }

  async getStreamStatus(uid: string): Promise<StreamStatusResponse> {
    const res = await fetch(`${this.baseUrl}/stream/${uid}`, {
      headers: this.headers(),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(`CF Stream status error: ${data.errors?.[0]?.message ?? 'unknown'}`);
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

    const data = await res.json();
    if (!data.success) {
      throw new Error(`CF Stream token error: ${data.errors?.[0]?.message ?? 'unknown'}`);
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
    const blob = new Blob([opts.buffer as unknown as ArrayBuffer], { type: opts.mimeType });
    formData.append('file', blob, `${opts.attachmentId}.${opts.mimeType.split('/')[1] || 'jpg'}`);
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

    const data = await res.json();
    if (!data.success) {
      this.logger.error(`CF Images upload failed: ${JSON.stringify(data.errors)}`);
      throw new Error(`Cloudflare Images error: ${data.errors?.[0]?.message ?? 'unknown'}`);
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
}
