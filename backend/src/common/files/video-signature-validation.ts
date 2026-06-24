const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'mp41',
  'mp42',
  'avc1',
  'qt  ',
  'M4V ',
  'M4A ',
]);

export function detectVideoMimeFromHeader(buffer: Buffer): string | null {
  if (buffer.length >= 12) {
    const boxType = buffer.toString('ascii', 4, 8);
    if (boxType === 'ftyp') {
      const majorBrand = buffer.toString('ascii', 8, 12);
      if (majorBrand === 'qt  ') {
        return 'video/quicktime';
      }
      if (MP4_BRANDS.has(majorBrand)) {
        return 'video/mp4';
      }
      for (
        let offset = 16;
        offset + 4 <= Math.min(buffer.length, 64);
        offset += 4
      ) {
        if (MP4_BRANDS.has(buffer.toString('ascii', offset, offset + 4))) {
          return majorBrand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
        }
      }
    }
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm';
  }

  return null;
}

export function extensionMatchesVideoMime(
  fileName: string,
  mimeType: string,
): boolean {
  const ext = fileName.toLowerCase().split('.').pop();
  if (mimeType === 'video/mp4') return ext === 'mp4' || ext === 'm4v';
  if (mimeType === 'video/webm') return ext === 'webm';
  if (mimeType === 'video/quicktime') return ext === 'mov' || ext === 'qt';
  return false;
}

export function extensionForVideoMime(
  fileName: string,
  mimeType: string,
): string {
  const ext = fileName.toLowerCase().split('.').pop();
  if (extensionMatchesVideoMime(fileName, mimeType) && ext) {
    return ext;
  }
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/quicktime') return 'mov';
  return 'mp4';
}
