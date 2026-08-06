import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/**
 * Headers de geolocalizacion de visitante que Vercel puede anteponer,
 * en orden de prioridad. Nunca se usa x-forwarded-for como unica fuente
 * de verdad mas alla de este punto: aqui solo se extrae un candidato que
 * luego se firma con HMAC antes de cruzar hacia Railway.
 */
const CLIENT_IP_HEADER_PRIORITY = [
  "x-vercel-forwarded-for",
  "x-forwarded-for",
  "x-real-ip",
] as const;

/** Headers del request original que son seguros y necesarios de reenviar tal cual. */
const FORWARDED_REQUEST_HEADERS = [
  "content-type",
  "cookie",
  "authorization",
  "user-agent",
] as const;

/** Headers de respuesta que no deben copiarse (hop-by-hop o invalidados por el body reenviado). */
const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
]);

export interface TrustedIpHeaders {
  clientIp: string | null;
  timestamp: string;
  signature: string | null;
}

/**
 * Extrae la IP publica del visitante desde los headers que Vercel antepone,
 * tomando el primer valor valido de la lista con mayor prioridad. Devuelve
 * null si ningun header trae una IP con formato valido (IPv4 o IPv6).
 */
export function getClientIp(headers: Headers): string | null {
  for (const headerName of CLIENT_IP_HEADER_PRIORITY) {
    const rawValue = headers.get(headerName);
    if (!rawValue) continue;

    const candidate = rawValue.split(",")[0]?.trim();
    if (candidate && isIP(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Firma HMAC-SHA256 (hex) de la cadena canonica METHOD\nPATH\nTIMESTAMP\nIP.
 * Debe coincidir exactamente con signTrustedClientIpPayload del backend
 * (backend/src/auth/trusted-client-ip.util.ts).
 */
export function signAuthProxyRequest(
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
  ].join("\n");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Construye los headers salientes hacia el backend desde cero (allowlist),
 * en vez de clonar los headers entrantes. Esto elimina implicitamente host,
 * content-length, cualquier header hop-by-hop y cualquier x-fentri-* que el
 * navegador hubiera intentado enviar: solo se agregan los que el propio
 * servidor de Vercel genera aqui.
 */
export function buildForwardHeaders(
  incomingHeaders: Headers,
  trusted: TrustedIpHeaders,
): Headers {
  const headers = new Headers();

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incomingHeaders.get(name);
    if (value) headers.set(name, value);
  }

  if (trusted.clientIp && trusted.signature) {
    headers.set("x-fentri-client-ip", trusted.clientIp);
    headers.set("x-fentri-proxy-timestamp", trusted.timestamp);
    headers.set("x-fentri-proxy-signature", trusted.signature);
  }

  return headers;
}

/**
 * Copia los headers de la respuesta del backend hacia la respuesta saliente,
 * preservando uno o varios Set-Cookie sin combinarlos en un solo valor.
 */
export function copyResponseHeaders(source: Headers, target: Headers): void {
  for (const cookie of source.getSetCookie()) {
    target.append("set-cookie", cookie);
  }

  source.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie" || HOP_BY_HOP_RESPONSE_HEADERS.has(lower)) return;
    target.set(lower, value);
  });
}
