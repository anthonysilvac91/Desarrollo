import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { detectVideoMimeFromHeader } from '../common/files/video-signature-validation';
import { AttachmentPolicy } from './upload-policy.service';

@Injectable()
export class UploadVerificationService {
  constructor(private readonly storageService: StorageService) {}

  async verifyUploadedObject(upload: any, policy: AttachmentPolicy) {
    const metadata = await this.storageService.getObjectMetadata(
      upload.storage_ref,
    );
    if (
      !metadata ||
      metadata.objectPath !== upload.storage_ref.split('/').slice(3).join('/')
    ) {
      throw new NotFoundException(
        'El objeto subido no existe en la ruta esperada',
      );
    }

    const actualSize = BigInt(metadata.sizeBytes ?? 0);
    if (actualSize <= 0n) {
      throw new BadRequestException('El objeto subido esta vacio');
    }
    if (actualSize > policy.maxVideoFileBytes) {
      throw new PayloadTooLargeException(
        'El video subido supera el tamano maximo permitido',
      );
    }

    const header = await this.storageService.readObjectRange(
      upload.storage_ref,
      0,
      65535,
    );
    const detectedMime = detectVideoMimeFromHeader(header);
    if (!detectedMime || !policy.allowedVideoMimeTypes.includes(detectedMime)) {
      throw new BadRequestException(
        'El contenido del video no coincide con un formato permitido',
      );
    }

    const declaredMime = String(upload.declared_mime_type).toLowerCase();
    if (
      declaredMime !== detectedMime &&
      !(declaredMime === 'video/quicktime' && detectedMime === 'video/mp4')
    ) {
      throw new BadRequestException(
        'El MIME declarado no coincide con el contenido del archivo',
      );
    }

    return {
      actualSize,
      detectedMime,
      storageMime: metadata.mimeType,
    };
  }
}
