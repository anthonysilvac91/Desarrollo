import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
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
        callback(new BadRequestException('Formato de imagen no permitido'), false);
        return;
      }

      callback(null, true);
    },
  };
}
