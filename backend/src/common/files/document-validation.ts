import { BadRequestException } from '@nestjs/common';

const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const DOCUMENT_SIGNATURES = [
  {
    mime: 'application/pdf',
    matches: (buffer: Buffer) =>
      buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  },
  {
    mime: 'application/zip',
    matches: (buffer: Buffer) =>
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04,
  },
  {
    mime: 'application/msword',
    matches: (buffer: Buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1,
  },
];

export interface DocumentValidationOptions {
  maxBytes: number;
  label: string;
}

export function validateDocumentFile(
  file: Express.Multer.File,
  options: DocumentValidationOptions,
): { mime: string } {
  if (!file) {
    throw new BadRequestException(`${options.label}: archivo requerido`);
  }

  if (!file.buffer?.length) {
    throw new BadRequestException(`${options.label}: archivo vacio o invalido`);
  }

  if (file.size > options.maxBytes) {
    const maxMB = Math.round(options.maxBytes / (1024 * 1024));
    throw new BadRequestException(
      `${options.label}: el archivo excede ${maxMB} MB`,
    );
  }

  const buffer = file.buffer;
  const detected = DOCUMENT_SIGNATURES.find((sig) => sig.matches(buffer));

  if (!detected) {
    throw new BadRequestException(
      `${options.label}: tipo de archivo no permitido. Solo se aceptan PDF, Word y Excel`,
    );
  }

  let finalMime = detected.mime;
  if (detected.mime === 'application/zip') {
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (ext === 'docx')
      finalMime =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'xlsx')
      finalMime =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else
      throw new BadRequestException(
        `${options.label}: tipo de archivo no permitido`,
      );
  }

  if (!ALLOWED_DOCUMENT_MIMES.includes(finalMime)) {
    throw new BadRequestException(
      `${options.label}: tipo de archivo no permitido`,
    );
  }

  return { mime: finalMime };
}

export function isDocumentMime(mime: string): boolean {
  return ALLOWED_DOCUMENT_MIMES.includes(mime);
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}
