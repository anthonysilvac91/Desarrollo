import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function imageUploadOptions(maxFileSizeBytes: number) {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: maxFileSizeBytes,
    },
    fileFilter: (
      _req: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
        callback(
          new BadRequestException('Formato de imagen no permitido'),
          false,
        );
        return;
      }

      callback(null, true);
    },
  };
}

export function fileUploadOptions(maxFileSizeBytes: number) {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: maxFileSizeBytes,
    },
    fileFilter: (
      _req: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (
        !ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) &&
        !ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)
      ) {
        callback(
          new BadRequestException('Formato de archivo no permitido'),
          false,
        );
        return;
      }

      callback(null, true);
    },
  };
}
