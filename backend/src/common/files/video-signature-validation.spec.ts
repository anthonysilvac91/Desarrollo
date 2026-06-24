import {
  detectVideoMimeFromHeader,
  extensionMatchesVideoMime,
} from './video-signature-validation';

describe('video-signature-validation', () => {
  it('detecta MP4 por caja ftyp', () => {
    const buffer = Buffer.alloc(32);
    buffer.writeUInt32BE(24, 0);
    buffer.write('ftyp', 4, 'ascii');
    buffer.write('isom', 8, 'ascii');

    expect(detectVideoMimeFromHeader(buffer)).toBe('video/mp4');
  });

  it('detecta MOV de iPhone por major brand qt', () => {
    const buffer = Buffer.alloc(32);
    buffer.writeUInt32BE(24, 0);
    buffer.write('ftyp', 4, 'ascii');
    buffer.write('qt  ', 8, 'ascii');

    expect(detectVideoMimeFromHeader(buffer)).toBe('video/quicktime');
  });

  it('detecta WebM por EBML', () => {
    expect(
      detectVideoMimeFromHeader(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00])),
    ).toBe('video/webm');
  });

  it('rechaza contenido falso', () => {
    expect(detectVideoMimeFromHeader(Buffer.from('not a video'))).toBeNull();
  });

  it('valida coherencia extension/mime', () => {
    expect(extensionMatchesVideoMime('clip.mp4', 'video/mp4')).toBe(true);
    expect(extensionMatchesVideoMime('clip.txt', 'video/mp4')).toBe(false);
  });
});
