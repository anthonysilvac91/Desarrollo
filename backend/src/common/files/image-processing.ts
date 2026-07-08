import sharp from 'sharp';

export interface ProcessImageOptions {
  maxWidth: number;
  maxHeight: number;
  format?: 'webp' | 'jpeg' | 'png';
  quality?: number;
}

function getOutputMime(format: 'webp' | 'jpeg' | 'png'): string {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
    default:
      return 'image/webp';
  }
}

export async function processUploadedImage(
  file: Express.Multer.File,
  options: ProcessImageOptions,
): Promise<Express.Multer.File> {
  const format = options.format ?? 'webp';
  const quality = options.quality ?? 82;

  let pipeline = sharp(file.buffer, { animated: false }).rotate().resize({
    width: options.maxWidth,
    height: options.maxHeight,
    fit: 'inside',
    withoutEnlargement: true,
  });

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
      break;
    case 'webp':
    default:
      pipeline = pipeline.webp({ quality, effort: 4 });
      break;
  }

  const outputBuffer = await pipeline.toBuffer();
  file.buffer = outputBuffer;
  file.size = outputBuffer.length;
  file.mimetype = getOutputMime(format);

  return file;
}

export interface GeneratedThumbnail {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * Genera un derivado chico (miniatura real) para usar en cards/listas, en vez
 * de servir el archivo de tamaño completo y dejar que el navegador lo achique.
 */
export async function generateThumbnail(
  sourceBuffer: Buffer,
  options: { maxWidth: number; maxHeight: number; quality?: number },
): Promise<GeneratedThumbnail> {
  const quality = options.quality ?? 60;

  const buffer = await sharp(sourceBuffer, { animated: false })
    .rotate()
    .resize({
      width: options.maxWidth,
      height: options.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();

  return { buffer, mimetype: 'image/webp', size: buffer.length };
}
