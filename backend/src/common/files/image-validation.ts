import { BadRequestException } from '@nestjs/common';

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const IMAGE_SIGNATURES = [
  {
    mime: 'image/jpeg',
    matches: (buffer: Buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    mime: 'image/png',
    matches: (buffer: Buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  {
    mime: 'image/webp',
    matches: (buffer: Buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'image/gif',
    matches: (buffer: Buffer) =>
      buffer.length >= 6 &&
      (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        buffer.subarray(0, 6).toString('ascii') === 'GIF89a'),
  },
];

export interface ImageValidationOptions {
  maxBytes: number;
  label: string;
  maxWidth?: number;
  maxHeight?: number;
  maxPixels?: number;
}

export interface ValidatedImageInfo {
  mime: string;
  extension: string;
  width: number;
  height: number;
  pixels: number;
}

export function getExtensionForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '';
  }
}

export function validateImageFile(file: Express.Multer.File, options: ImageValidationOptions): ValidatedImageInfo {
  if (!file) {
    throw new BadRequestException(`${options.label}: archivo requerido`);
  }

  if (!file.buffer?.length) {
    throw new BadRequestException(`${options.label}: archivo vacio o invalido`);
  }

  if (file.size > options.maxBytes) {
    throw new BadRequestException(`${options.label}: excede el maximo permitido`);
  }

  const detected = IMAGE_SIGNATURES.find((signature) => signature.matches(file.buffer));
  if (!detected) {
    throw new BadRequestException(`${options.label}: formato de imagen no permitido`);
  }

  const dimensions = getImageDimensions(file.buffer, detected.mime);
  if (!dimensions) {
    throw new BadRequestException(`${options.label}: no se pudieron leer las dimensiones de la imagen`);
  }

  const pixels = dimensions.width * dimensions.height;

  if (options.maxWidth && dimensions.width > options.maxWidth) {
    throw new BadRequestException(`${options.label}: ancho excede el maximo permitido`);
  }

  if (options.maxHeight && dimensions.height > options.maxHeight) {
    throw new BadRequestException(`${options.label}: alto excede el maximo permitido`);
  }

  if (options.maxPixels && pixels > options.maxPixels) {
    throw new BadRequestException(`${options.label}: resolucion excede el maximo permitido`);
  }

  return {
    mime: detected.mime,
    extension: getExtensionForMime(detected.mime),
    width: dimensions.width,
    height: dimensions.height,
    pixels,
  };
}

export function ensureNoManualFileUrl(value: string | undefined, label: string) {
  if (value && value.trim().length > 0) {
    throw new BadRequestException(`${label}: debes subir el archivo, no enviar una URL manual`);
  }
}

function getImageDimensions(buffer: Buffer, mime: string): { width: number; height: number } | null {
  switch (mime) {
    case 'image/png':
      return readPngDimensions(buffer);
    case 'image/gif':
      return readGifDimensions(buffer);
    case 'image/webp':
      return readWebpDimensions(buffer);
    case 'image/jpeg':
      return readJpegDimensions(buffer);
    default:
      return null;
  }
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readGifDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) {
    return null;
  }

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function readWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) {
    return null;
  }

  const chunkType = buffer.subarray(12, 16).toString('ascii');

  if (chunkType === 'VP8 ') {
    if (buffer.length < 30) {
      return null;
    }
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === 'VP8L') {
    if (buffer.length < 25) {
      return null;
    }
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }

  if (chunkType === 'VP8X') {
    if (buffer.length < 30) {
      return null;
    }
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  return null;
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (!marker || marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + segmentLength + 2 > buffer.length) {
      return null;
    }

    if (SOF_MARKERS.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}
