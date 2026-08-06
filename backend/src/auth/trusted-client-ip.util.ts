import { createHmac, timingSafeEqual } from 'crypto';
import { isIP } from 'net';

/** Ventana de tolerancia de reloj entre Vercel y Railway, en ambas direcciones. */
export const TRUSTED_CLIENT_IP_CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface TrustedClientIpCandidate {
  method: string;
  originalUrl: string;
  clientIp?: string;
  timestamp?: string;
  signature?: string;
}

export function signTrustedClientIpPayload(
  method: string,
  backendPathWithQuery: string,
  timestamp: string,
  clientIp: string,
  secret: string,
): string {
  const payload = [
    method.toUpperCase(),
    backendPathWithQuery,
    timestamp,
    clientIp,
  ].join('\n');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifica el header x-fentri-client-ip firmado por el auth-proxy de Vercel.
 * Devuelve la IP solo si la firma HMAC es valida y el timestamp esta dentro
 * de la ventana de tolerancia; en cualquier otro caso devuelve null. Nunca
 * lanza: un fallo de verificacion debe resolverse con los fallbacks
 * habituales de captura de IP, no con un error de autenticacion.
 */
export function resolveTrustedClientIp(
  candidate: TrustedClientIpCandidate,
  secret: string | undefined,
  now: number = Date.now(),
): string | null {
  const { method, originalUrl, clientIp, timestamp, signature } = candidate;

  if (!secret || !clientIp || !timestamp || !signature) return null;
  if (!isIP(clientIp)) return null;

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) return null;
  if (Math.abs(now - timestampMs) > TRUSTED_CLIENT_IP_CLOCK_SKEW_MS)
    return null;

  const expected = signTrustedClientIpPayload(
    method,
    originalUrl,
    timestamp,
    clientIp,
    secret,
  );

  return safeEqualHex(expected, signature) ? clientIp : null;
}

function safeEqualHex(expectedHex: string, receivedHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(receivedHex, 'hex');
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
