describe('TUS Metadata encoding', () => {
  function encodeTusMetadataValue(value: string): string {
    return Buffer.from(value, 'utf-8').toString('base64');
  }

  function buildTusMetadata(meta: Record<string, string>): string {
    return Object.entries(meta)
      .filter(([, v]) => v !== '')
      .map(([key, value]) => `${key} ${encodeTusMetadataValue(value)}`)
      .join(',');
  }

  it('encodes simple ASCII filename', () => {
    const result = buildTusMetadata({ name: 'test.mp4' });
    expect(result).toBe(`name ${Buffer.from('test.mp4').toString('base64')}`);
  });

  it('encodes filename with spaces', () => {
    const result = buildTusMetadata({ name: 'my video file.mp4' });
    const decoded = Buffer.from(result.split(' ')[1], 'base64').toString();
    expect(decoded).toBe('my video file.mp4');
  });

  it('encodes Unicode filename', () => {
    const result = buildTusMetadata({ name: 'vídeo_español_日本語.mp4' });
    const decoded = Buffer.from(result.split(' ')[1], 'base64').toString('utf-8');
    expect(decoded).toBe('vídeo_español_日本語.mp4');
  });

  it('uses space between key and value, comma between pairs', () => {
    const result = buildTusMetadata({
      name: 'test.mp4',
      maxDurationSeconds: '600',
    });
    const pairs = result.split(',');
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatch(/^name .+$/);
    expect(pairs[1]).toMatch(/^maxDurationSeconds .+$/);
  });

  it('omits empty values', () => {
    const result = buildTusMetadata({
      name: 'test.mp4',
      requiresignedurls: '',
      maxDurationSeconds: '600',
    });
    expect(result).not.toContain('requiresignedurls');
    expect(result.split(',')).toHaveLength(2);
  });

  it('base64 values are decodable', () => {
    const result = buildTusMetadata({
      name: 'test.mp4',
      maxDurationSeconds: '600',
      expiry: '2026-06-25T00:00:00.000Z',
    });

    for (const pair of result.split(',')) {
      const spaceIdx = pair.indexOf(' ');
      const key = pair.substring(0, spaceIdx);
      const b64 = pair.substring(spaceIdx + 1);
      expect(key.length).toBeGreaterThan(0);
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      expect(decoded.length).toBeGreaterThan(0);
    }
  });

  it('does not use = as separator between key and value', () => {
    const result = buildTusMetadata({ name: 'test.mp4' });
    const keyPart = result.split(' ')[0];
    expect(keyPart).not.toContain('=');
  });
});
