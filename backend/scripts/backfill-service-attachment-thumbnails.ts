import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { StoredFilesService } from '../src/storage/stored-files.service';
import { generateThumbnail } from '../src/common/files/image-processing';
import { buildServiceAttachmentsPath } from '../src/common/files/storage-paths';
import { StoredFileKind } from '@prisma/client';

const THUMBNAIL_DIMENSION = 150;
const THUMBNAIL_QUALITY = 60;
const BATCH_SIZE = 25;

async function bootstrap() {
  const logger = new Logger('ServiceAttachmentThumbnailBackfill');
  const dryRun = process.argv.includes('--dry-run');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const storageService = app.get(StorageService);
    const storedFilesService = app.get(StoredFilesService);
    const configService = app.get(ConfigService);
    const baseUrl = (configService.get<string>('BASE_URL') || '').replace(/\/$/, '');

    logger.log(`Iniciando backfill de thumbnails${dryRun ? ' (dry-run)' : ''}`);

    let processed = 0;
    let succeeded = 0;
    const failed: Array<{ attachmentId: string; error: string }> = [];
    let skip = dryRun ? 0 : undefined;

    while (true) {
      const pending = await prisma.serviceAttachment.findMany({
        where: {
          media_type: 'IMAGE',
          file_id: { not: null },
          thumbnail_file_id: null,
        },
        take: BATCH_SIZE,
        skip,
        orderBy: { id: 'asc' },
        include: {
          file: { select: { storage_ref: true, original_name: true } },
          service: { select: { organization_id: true } },
        },
      });

      if (pending.length === 0) break;
      if (dryRun) skip = (skip ?? 0) + pending.length;

      for (const attachment of pending) {
        processed += 1;
        try {
          if (!attachment.file?.storage_ref || !attachment.service) {
            throw new Error('Adjunto sin storage_ref o servicio asociado');
          }

          const resolvedRef = await storageService.resolveFileUrl(
            attachment.file.storage_ref,
          );
          const fetchUrl = resolvedRef.startsWith('http')
            ? resolvedRef
            : `${baseUrl}${resolvedRef}`;

          const response = await fetch(fetchUrl);
          if (!response.ok) {
            throw new Error(`No se pudo descargar el original (HTTP ${response.status})`);
          }
          const sourceBuffer = Buffer.from(await response.arrayBuffer());

          const thumbnail = await generateThumbnail(sourceBuffer, {
            maxWidth: THUMBNAIL_DIMENSION,
            maxHeight: THUMBNAIL_DIMENSION,
            quality: THUMBNAIL_QUALITY,
          });

          if (dryRun) {
            succeeded += 1;
            continue;
          }

          const thumbnailFile = {
            buffer: thumbnail.buffer,
            mimetype: thumbnail.mimetype,
            originalname: attachment.file.original_name || 'thumbnail.webp',
            size: thumbnail.size,
          } as Express.Multer.File;

          const thumbnailUrl = await storageService.uploadFile(thumbnailFile, {
            folder: buildServiceAttachmentsPath(
              attachment.service.organization_id,
              attachment.service_id,
            ),
            visibility: 'private',
          });

          const storedThumbnail = await storedFilesService.registerUploadedFile({
            organizationId: attachment.service.organization_id,
            storageRef: thumbnailUrl,
            originalName: thumbnailFile.originalname,
            mimeType: thumbnail.mimetype,
            sizeBytes: thumbnail.size,
            kind: StoredFileKind.SERVICE_ATTACHMENT_THUMBNAIL,
            visibility: 'private',
            entityType: 'SERVICE',
            entityId: attachment.service_id,
          });

          await prisma.serviceAttachment.update({
            where: { id: attachment.id },
            data: { thumbnail_file_id: storedThumbnail.id },
          });

          succeeded += 1;
        } catch (error) {
          failed.push({
            attachmentId: attachment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.log(`Progreso: ${processed} procesados, ${succeeded} ok, ${failed.length} fallidos`);
    }

    logger.log(`Backfill completado${dryRun ? ' (dry-run)' : ''}`);
    process.stdout.write(
      `${JSON.stringify({ processed, succeeded, failed }, null, 2)}\n`,
    );
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
