import { BadRequestException } from '@nestjs/common';

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
}

export function validateImageFile(file: Express.Multer.File, options: ImageValidationOptions): string {
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

  return detected.mime;
}

export function ensureNoManualFileUrl(value: string | undefined, label: string) {
  if (value && value.trim().length > 0) {
    throw new BadRequestException(`${label}: debes subir el archivo, no enviar una URL manual`);
  }
}
