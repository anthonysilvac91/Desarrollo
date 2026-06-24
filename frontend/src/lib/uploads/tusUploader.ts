import * as tus from "tus-js-client";
import { UploadIntent } from "@/types/uploads";

export interface TusUploadHandlers {
  onProgress: (bytesUploaded: number, bytesTotal: number) => void;
  onSuccess: () => void;
  onError: (error: Error) => void;
}

export function createTusUpload(file: File, intent: UploadIntent, handlers: TusUploadHandlers) {
  if (intent.cfStreamUploadUrl) {
    return createCfStreamTusUpload(file, intent.cfStreamUploadUrl, intent.chunkSizeBytes, handlers);
  }

  return new tus.Upload(file, {
    endpoint: intent.tusEndpoint,
    chunkSize: intent.chunkSizeBytes,
    retryDelays: [0, 1000, 3000, 5000],
    removeFingerprintOnSuccess: true,
    metadata: {
      bucketName: intent.bucket!,
      objectName: intent.objectPath!,
      contentType: file.type,
      cacheControl: "3600",
    },
    headers: {
      "x-upsert": "false",
      "x-signature": intent.signedUploadToken!,
    },
    onProgress: handlers.onProgress,
    onSuccess: handlers.onSuccess,
    onError: handlers.onError,
  });
}

function createCfStreamTusUpload(
  file: File,
  uploadUrl: string,
  chunkSize: number,
  handlers: TusUploadHandlers,
) {
  return new tus.Upload(file, {
    endpoint: uploadUrl,
    uploadUrl,
    chunkSize,
    retryDelays: [0, 3000, 5000, 10000],
    removeFingerprintOnSuccess: true,
    metadata: {
      name: file.name,
      type: file.type,
    },
    onProgress: handlers.onProgress,
    onSuccess: handlers.onSuccess,
    onError: handlers.onError,
  });
}
