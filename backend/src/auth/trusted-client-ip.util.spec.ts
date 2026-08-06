import {
  resolveTrustedClientIp,
  signTrustedClientIpPayload,
  TRUSTED_CLIENT_IP_CLOCK_SKEW_MS,
} from './trusted-client-ip.util';

describe('trusted-client-ip.util', () => {
  const SECRET = 'test-hmac-secret';
  const NOW = 1_770_000_000_000;

  const sign = (
    method: string,
    originalUrl: string,
    timestamp: string,
    clientIp: string,
    secret = SECRET,
  ) =>
    signTrustedClientIpPayload(
      method,
      originalUrl,
      timestamp,
      clientIp,
      secret,
    );

  const validCandidate = (
    overrides: Partial<Parameters<typeof resolveTrustedClientIp>[0]> = {},
  ) => {
    const method = 'POST';
    const originalUrl = '/auth/login';
    const timestamp = String(NOW);
    const clientIp = '186.11.74.13';
    return {
      method,
      originalUrl,
      clientIp,
      timestamp,
      signature: sign(method, originalUrl, timestamp, clientIp),
      ...overrides,
    };
  };

  it('una firma valida devuelve la IP', () => {
    const result = resolveTrustedClientIp(validCandidate(), SECRET, NOW);
    expect(result).toBe('186.11.74.13');
  });

  it('una firma invalida (contenido alterado) se ignora', () => {
    const candidate = validCandidate();
    const tampered = { ...candidate, clientIp: '56.125.190.173' };
    const result = resolveTrustedClientIp(tampered, SECRET, NOW);
    expect(result).toBeNull();
  });

  it('una firma con secreto distinto se ignora', () => {
    const candidate = validCandidate();
    const result = resolveTrustedClientIp(candidate, 'otro-secreto', NOW);
    expect(result).toBeNull();
  });

  it('un timestamp vencido (mas de 5 minutos en el pasado) se ignora', () => {
    const staleTimestamp = String(NOW - TRUSTED_CLIENT_IP_CLOCK_SKEW_MS - 1000);
    const method = 'POST';
    const originalUrl = '/auth/login';
    const clientIp = '186.11.74.13';
    const candidate = {
      method,
      originalUrl,
      clientIp,
      timestamp: staleTimestamp,
      signature: sign(method, originalUrl, staleTimestamp, clientIp),
    };
    expect(resolveTrustedClientIp(candidate, SECRET, NOW)).toBeNull();
  });

  it('un timestamp futuro fuera del margen se ignora', () => {
    const futureTimestamp = String(
      NOW + TRUSTED_CLIENT_IP_CLOCK_SKEW_MS + 1000,
    );
    const method = 'POST';
    const originalUrl = '/auth/login';
    const clientIp = '186.11.74.13';
    const candidate = {
      method,
      originalUrl,
      clientIp,
      timestamp: futureTimestamp,
      signature: sign(method, originalUrl, futureTimestamp, clientIp),
    };
    expect(resolveTrustedClientIp(candidate, SECRET, NOW)).toBeNull();
  });

  it('un timestamp dentro del margen (justo dentro de 5 minutos) es valido', () => {
    const nearTimestamp = String(NOW - TRUSTED_CLIENT_IP_CLOCK_SKEW_MS + 1000);
    const method = 'POST';
    const originalUrl = '/auth/login';
    const clientIp = '186.11.74.13';
    const candidate = {
      method,
      originalUrl,
      clientIp,
      timestamp: nearTimestamp,
      signature: sign(method, originalUrl, nearTimestamp, clientIp),
    };
    expect(resolveTrustedClientIp(candidate, SECRET, NOW)).toBe('186.11.74.13');
  });

  it('una IP invalida se ignora aunque la firma sea correcta', () => {
    const method = 'POST';
    const originalUrl = '/auth/login';
    const timestamp = String(NOW);
    const clientIp = 'not-an-ip';
    const candidate = {
      method,
      originalUrl,
      clientIp,
      timestamp,
      signature: sign(method, originalUrl, timestamp, clientIp),
    };
    expect(resolveTrustedClientIp(candidate, SECRET, NOW)).toBeNull();
  });

  it('sin secreto configurado devuelve null (el llamador cae a x-real-ip)', () => {
    const result = resolveTrustedClientIp(validCandidate(), undefined, NOW);
    expect(result).toBeNull();
  });

  it('un atacante que solo controla x-forwarded-for no puede imponer una IP', () => {
    // resolveTrustedClientIp ni siquiera acepta un campo x-forwarded-for:
    // solo confia en clientIp cuando viene acompañado de una firma HMAC
    // valida. Sin secreto/timestamp/firma, cualquier IP es ignorada.
    const result = resolveTrustedClientIp(
      {
        method: 'POST',
        originalUrl: '/auth/login',
        clientIp: '1.2.3.4',
      },
      SECRET,
      NOW,
    );
    expect(result).toBeNull();
  });

  it('la comparacion de firmas no lanza con longitudes distintas (timingSafeEqual seguro)', () => {
    const candidate = validCandidate({ signature: 'ab' });
    expect(() => resolveTrustedClientIp(candidate, SECRET, NOW)).not.toThrow();
    expect(resolveTrustedClientIp(candidate, SECRET, NOW)).toBeNull();
  });

  it('la comparacion de firmas no lanza con una firma no-hexadecimal', () => {
    const candidate = validCandidate({ signature: 'not-hex-at-all!!' });
    expect(() => resolveTrustedClientIp(candidate, SECRET, NOW)).not.toThrow();
    expect(resolveTrustedClientIp(candidate, SECRET, NOW)).toBeNull();
  });

  it('funciona con una IPv4 valida', () => {
    const method = 'POST';
    const originalUrl = '/auth/login';
    const timestamp = String(NOW);
    const clientIp = '203.0.113.42';
    const candidate = {
      method,
      originalUrl,
      clientIp,
      timestamp,
      signature: sign(method, originalUrl, timestamp, clientIp),
    };
    expect(resolveTrustedClientIp(candidate, SECRET, NOW)).toBe('203.0.113.42');
  });

  it('funciona con una IPv6 valida', () => {
    const method = 'POST';
    const originalUrl = '/auth/login';
    const timestamp = String(NOW);
    const clientIp = '2001:db8::1';
    const candidate = {
      method,
      originalUrl,
      clientIp,
      timestamp,
      signature: sign(method, originalUrl, timestamp, clientIp),
    };
    expect(resolveTrustedClientIp(candidate, SECRET, NOW)).toBe('2001:db8::1');
  });

  it('el metodo y la ruta firmados deben coincidir exactamente (evita replay cruzado)', () => {
    const candidate = validCandidate({ originalUrl: '/auth/me' });
    expect(resolveTrustedClientIp(candidate, SECRET, NOW)).toBeNull();
  });

  it('falta timestamp o firma se ignora sin lanzar', () => {
    const base = validCandidate();
    expect(
      resolveTrustedClientIp({ ...base, timestamp: undefined }, SECRET, NOW),
    ).toBeNull();
    expect(
      resolveTrustedClientIp({ ...base, signature: undefined }, SECRET, NOW),
    ).toBeNull();
    expect(
      resolveTrustedClientIp({ ...base, clientIp: undefined }, SECRET, NOW),
    ).toBeNull();
  });
});
