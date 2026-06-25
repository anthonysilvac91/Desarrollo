import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CloudflareService } from './cloudflare.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('CloudflareService', () => {
  let service: CloudflareService;

  beforeEach(async () => {
    mockFetch.mockReset();

    const configValues: Record<string, string> = {
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN: 'test.cloudflarestream.com',
      CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS: '3600',
      CLOUDFLARE_STREAM_SIGNED_URLS: 'false',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudflareService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => configValues[key] ?? def),
          },
        },
      ],
    }).compile();

    service = module.get(CloudflareService);
  });

  describe('createStreamDirectUpload (TUS)', () => {
    it('sends POST to /stream?direct_user=true with TUS headers', async () => {
      mockFetch.mockResolvedValue({
        status: 201,
        headers: new Map([
          ['location', 'https://upload.cloudflarestream.com/tus/abc123'],
          ['stream-media-id', 'abc123'],
        ]),
      });

      await service.createStreamDirectUpload({
        maxDurationSeconds: 600,
        uploadLengthBytes: 49_300_000,
        organizationId: 'org-1',
        serviceId: 'svc-1',
        uploadId: 'upload-1',
      });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/stream?direct_user=true');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Tus-Resumable']).toBe('1.0.0');
      expect(opts.headers['Upload-Length']).toBe('49300000');
      expect(opts.headers['Upload-Metadata']).toBeDefined();
    });

    it('does NOT send body (TUS creation has no body)', async () => {
      mockFetch.mockResolvedValue({
        status: 201,
        headers: new Map([
          ['location', 'https://upload.cloudflarestream.com/tus/abc123'],
          ['stream-media-id', 'abc123'],
        ]),
      });

      await service.createStreamDirectUpload({
        maxDurationSeconds: 600,
        uploadLengthBytes: 49_300_000,
        organizationId: 'org-1',
        serviceId: 'svc-1',
        uploadId: 'upload-1',
      });

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.body).toBeUndefined();
    });

    it('returns Location as uploadUrl and stream-media-id as uid', async () => {
      const tusUrl = 'https://upload.cloudflarestream.com/tus/xyz789';
      mockFetch.mockResolvedValue({
        status: 201,
        headers: new Map([
          ['location', tusUrl],
          ['stream-media-id', 'xyz789'],
        ]),
      });

      const result = await service.createStreamDirectUpload({
        maxDurationSeconds: 600,
        uploadLengthBytes: 93_800_000,
        organizationId: 'org-1',
        serviceId: 'svc-1',
        uploadId: 'upload-1',
      });

      expect(result.uid).toBe('xyz789');
      expect(result.uploadUrl).toBe(tusUrl);
      expect(result.expiresAt).toBeDefined();
    });

    it('builds Upload-Metadata with base64 values separated by commas', async () => {
      mockFetch.mockResolvedValue({
        status: 201,
        headers: new Map([
          ['location', 'https://upload.cloudflarestream.com/tus/abc'],
          ['stream-media-id', 'abc'],
        ]),
      });

      await service.createStreamDirectUpload({
        maxDurationSeconds: 600,
        uploadLengthBytes: 1000,
        organizationId: 'org-1',
        serviceId: 'svc-1',
        uploadId: 'upload-1',
      });

      const metadata = mockFetch.mock.calls[0][1].headers['Upload-Metadata'];
      const pairs = metadata.split(',');
      for (const pair of pairs) {
        const [key, value] = pair.split(' ');
        expect(key).toBeTruthy();
        expect(value).toBeTruthy();
        expect(() => Buffer.from(value, 'base64').toString()).not.toThrow();
      }
      expect(metadata).toContain('name ');
      expect(metadata).toContain('maxDurationSeconds ');
    });

    it('throws on non-201 response', async () => {
      mockFetch.mockResolvedValue({
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request'),
        headers: new Map(),
      });

      await expect(
        service.createStreamDirectUpload({
          maxDurationSeconds: 600,
          uploadLengthBytes: 1000,
          organizationId: 'org-1',
          serviceId: 'svc-1',
          uploadId: 'upload-1',
        }),
      ).rejects.toThrow('Cloudflare TUS creation failed');
    });

    it('throws when Location header is missing', async () => {
      mockFetch.mockResolvedValue({
        status: 201,
        headers: new Map([['stream-media-id', 'abc']]),
      });

      await expect(
        service.createStreamDirectUpload({
          maxDurationSeconds: 600,
          uploadLengthBytes: 1000,
          organizationId: 'org-1',
          serviceId: 'svc-1',
          uploadId: 'upload-1',
        }),
      ).rejects.toThrow('missing Location');
    });

    it('handles 49 MB file size correctly', async () => {
      const sizeBytes = 49_300_000;
      mockFetch.mockResolvedValue({
        status: 201,
        headers: new Map([
          ['location', 'https://upload.cloudflarestream.com/tus/abc'],
          ['stream-media-id', 'abc'],
        ]),
      });

      await service.createStreamDirectUpload({
        maxDurationSeconds: 600,
        uploadLengthBytes: sizeBytes,
        organizationId: 'org-1',
        serviceId: 'svc-1',
        uploadId: 'upload-1',
      });

      expect(mockFetch.mock.calls[0][1].headers['Upload-Length']).toBe(
        String(sizeBytes),
      );
    });

    it('handles 94 MB file size correctly', async () => {
      const sizeBytes = 93_800_000;
      mockFetch.mockResolvedValue({
        status: 201,
        headers: new Map([
          ['location', 'https://upload.cloudflarestream.com/tus/abc'],
          ['stream-media-id', 'abc'],
        ]),
      });

      await service.createStreamDirectUpload({
        maxDurationSeconds: 600,
        uploadLengthBytes: sizeBytes,
        organizationId: 'org-1',
        serviceId: 'svc-1',
        uploadId: 'upload-1',
      });

      expect(mockFetch.mock.calls[0][1].headers['Upload-Length']).toBe(
        String(sizeBytes),
      );
    });
  });
});
