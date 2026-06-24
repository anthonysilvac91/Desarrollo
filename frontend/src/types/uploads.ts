import { Service } from "@/services/services.service";

export type UploadMediaType = "IMAGE" | "VIDEO" | "DOCUMENT";

export type UploadQueueStatus =
  | "queued"
  | "authorizing"
  | "uploading"
  | "paused"
  | "confirming"
  | "completed"
  | "failed"
  | "cancelled"
  | "needs_file";

export interface AttachmentConfig {
  videoUploadsEnabled: boolean;
  maxVideoFileBytes: string;
  maxBatchSize: number;
  uploadConcurrency: number;
  allowedVideoMimeTypes: string[];
  storage: {
    quotaBytes: string;
    readyBytes: string;
    reservedBytes: string;
    availableBytes: string;
  };
}

export interface UploadIntent {
  clientId?: string;
  uploadId: string;
  expiresAt: string;
  chunkSizeBytes: number;
  // Supabase TUS (legacy)
  bucket?: string;
  objectPath?: string;
  signedUploadToken?: string;
  tusEndpoint?: string;
  // Cloudflare Stream
  cfStreamUploadUrl?: string;
  cfStreamUid?: string;
  mediaType?: string;
}

export interface PlaybackData {
  url?: string;
  embedUrl?: string;
  hlsUrl?: string;
  cfStreamUid?: string;
  duration?: number | null;
  thumbnail?: string | null;
  expiresAt?: string;
}

export interface UploadQueueItem {
  localId: string;
  uploadId?: string;
  serviceId: string;
  file?: File;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: UploadMediaType;
  status: UploadQueueStatus;
  progress: number;
  bytesUploaded: number;
  error?: string;
  intent?: UploadIntent;
  service?: Service;
  attachment?: unknown;
}
