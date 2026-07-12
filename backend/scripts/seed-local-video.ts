import 'reflect-metadata';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { StoredFilesService } from '../src/storage/stored-files.service';
import { UploadsService } from '../src/uploads/uploads.service';
import { buildServiceAttachmentsPath } from '../src/common/files/storage-paths';
import {
  detectVideoMimeFromHeader,
  extensionForVideoMime,
} from '../src/common/files/video-signature-validation';
import { StoredFileKind } from '@prisma/client';

function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegInstaller.path, args, (error, stdout, stderr) => {
      if (error && !stderr) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

// Extrae duracion + un frame de preview invocando el binario de ffmpeg
// directamente (devDependency @ffmpeg-installer/ffmpeg, solo usada por este
// script). No corre en el flujo real de subida ni en produccion.
// (fluent-ffmpeg se probo primero pero su modo .screenshots() falla en
// Windows con este binario; invocar el exe directo es mas confiable).
async function extractVideoMeta(
  videoPath: string,
): Promise<{ durationSeconds: number | null; thumbnailBuffer: Buffer | null }> {
  let durationSeconds: number | null = null;
  try {
    const { stderr } = await runFfmpeg(['-i', videoPath]);
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match) {
      const [, hh, mm, ss] = match;
      durationSeconds = Math.round(
        Number(hh) * 3600 + Number(mm) * 60 + Number(ss),
      );
    }
  } catch {
    // sin duracion disponible, se deja null
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-video-thumb-'));
  const thumbPath = path.join(tmpDir, 'thumb.jpg');
  let thumbnailBuffer: Buffer | null = null;
  try {
    const seekTo = durationSeconds ? Math.min(2, Math.floor(durationSeconds / 2)) : 0;
    await runFfmpeg([
      '-y',
      '-ss',
      String(seekTo),
      '-i',
      videoPath,
      '-vframes',
      '1',
      '-vf',
      'scale=480:-1',
      thumbPath,
    ]);
    if (fs.existsSync(thumbPath)) {
      thumbnailBuffer = fs.readFileSync(thumbPath);
    }
  } catch {
    // sin miniatura disponible, se deja null
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return { durationSeconds, thumbnailBuffer };
}

// Dev-only: adjunta un video real (de disco) a un Service existente, saltando
// por completo el flujo de signed-upload/TUS que localmente no funciona
// (STORAGE_TYPE=local no implementa createSignedUploadIntent — ver
// storage.service.ts). Solo escribe en Postgres/disco local; no toca
// Cloudflare ni Supabase, así que no puede afectar producción.
//
// Uso:
//   npx ts-node scripts/seed-local-video.ts --file <ruta-al-video.mp4>
//   (usa el ultimo Service creado si no se pasa --service)
//   npx ts-node scripts/seed-local-video.ts --service <serviceId> --file <ruta-al-video.mp4>

function parseArgs() {
  const args = process.argv.slice(2);
  let serviceId: string | undefined;
  let filePath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--service') {
      serviceId = args[++i];
      continue;
    }
    if (args[i] === '--file') {
      filePath = args[++i];
      continue;
    }
    if (!args[i].startsWith('--') && !filePath) {
      filePath = args[i];
    }
  }
  return { serviceId, filePath };
}

function guessMimeFromExtension(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov' || ext === 'qt') return 'video/quicktime';
  return 'video/mp4';
}

async function bootstrap() {
  const logger = new Logger('SeedLocalVideo');
  const { serviceId, filePath } = parseArgs();

  if (!filePath) {
    logger.error(
      'Uso: npx ts-node scripts/seed-local-video.ts --file <ruta-al-video.mp4> [--service <serviceId>]\n' +
        'Sin --service, usa el ultimo Service creado.',
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    logger.error(`Archivo no encontrado: ${resolvedPath}`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const storageService = app.get(StorageService);
    const storedFilesService = app.get(StoredFilesService);
    const uploadsService = app.get(UploadsService);

    const service = serviceId
      ? await prisma.service.findUnique({
          where: { id: serviceId },
          select: { id: true, organization_id: true, worker_id: true, title: true },
        })
      : await prisma.service.findFirst({
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          select: { id: true, organization_id: true, worker_id: true, title: true },
        });

    if (!service) {
      logger.error(
        serviceId
          ? `Service ${serviceId} no existe`
          : 'No hay ningun Service en la base local. Crea uno primero desde la UI.',
      );
      process.exit(1);
    }

    if (!serviceId) {
      logger.log(`Usando el ultimo Service creado: "${service.title}" (${service.id})`);
    }

    const buffer = fs.readFileSync(resolvedPath);
    const originalName = path.basename(resolvedPath);
    const mimeType =
      detectVideoMimeFromHeader(buffer) ?? guessMimeFromExtension(originalName);
    const ext = extensionForVideoMime(originalName, mimeType);

    const fakeFile = {
      buffer,
      mimetype: mimeType,
      originalname: `${path.basename(originalName, path.extname(originalName))}.${ext}`,
      size: buffer.length,
    } as Express.Multer.File;

    const attachmentsFolder = buildServiceAttachmentsPath(
      service.organization_id,
      service.id,
    );

    const storageRef = await storageService.uploadFile(fakeFile, {
      folder: attachmentsFolder,
      visibility: 'private',
    });

    const storedFile = await storedFilesService.registerUploadedFile({
      organizationId: service.organization_id,
      storageRef,
      originalName: fakeFile.originalname,
      mimeType,
      sizeBytes: buffer.length,
      kind: StoredFileKind.SERVICE_ATTACHMENT,
      visibility: 'private',
      entityType: 'SERVICE',
      entityId: service.id,
      uploadedByUserId: service.worker_id,
    });

    logger.log('Extrayendo miniatura y duracion con ffmpeg...');
    const { durationSeconds, thumbnailBuffer } =
      await extractVideoMeta(resolvedPath);

    let thumbnailStoredFile: { id: string } | null = null;
    if (thumbnailBuffer) {
      const thumbnailRef = await storageService.uploadFile(
        {
          buffer: thumbnailBuffer,
          mimetype: 'image/jpeg',
          originalname: 'thumbnail.jpg',
          size: thumbnailBuffer.length,
        } as Express.Multer.File,
        { folder: attachmentsFolder, visibility: 'private' },
      );
      thumbnailStoredFile = await storedFilesService.registerUploadedFile({
        organizationId: service.organization_id,
        storageRef: thumbnailRef,
        originalName: 'thumbnail.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: thumbnailBuffer.length,
        kind: StoredFileKind.SERVICE_ATTACHMENT_THUMBNAIL,
        visibility: 'private',
        entityType: 'SERVICE',
        entityId: service.id,
        uploadedByUserId: service.worker_id,
      });
    } else {
      logger.warn(
        'No se pudo generar la miniatura (ffmpeg fallo); el adjunto quedara sin preview.',
      );
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fileUpload = await prisma.fileUpload.create({
      data: {
        organization_id: service.organization_id,
        service_id: service.id,
        created_by_user_id: service.worker_id,
        storage_ref: storageRef,
        original_name: fakeFile.originalname,
        declared_mime_type: mimeType,
        detected_mime_type: mimeType,
        declared_size_bytes: BigInt(buffer.length),
        actual_size_bytes: BigInt(buffer.length),
        media_type: 'VIDEO',
        status: 'CONFIRMED',
        expires_at: expiresAt,
        upload_completed_at: new Date(),
        confirmed_at: new Date(),
        local_progress: 100,
      },
    });

    await prisma.serviceAttachment.create({
      data: {
        service_id: service.id,
        upload_id: fileUpload.id,
        file_id: storedFile.id,
        thumbnail_file_id: thumbnailStoredFile?.id,
        file_type: mimeType,
        file_name: fakeFile.originalname,
        file_size_bytes: buffer.length,
        media_type: 'VIDEO',
        duration_seconds: durationSeconds,
      },
    });

    await uploadsService.refreshServiceAttachmentSnapshot(service.id);

    logger.log(
      `Listo. Video adjuntado al Service ${service.id} (uploadId=${fileUpload.id}, storageRef=${storageRef})`,
    );
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
