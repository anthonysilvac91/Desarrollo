/**
 * Auth proxy unit tests.
 *
 * These run as plain Node functions (no `page` fixture), same pattern as
 * proxy.spec.ts: import the pure helpers and the route handlers directly and
 * call them, mocking global fetch instead of hitting a real backend.
 */
import { createHmac } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import {
  buildForwardHeaders,
  copyResponseHeaders,
  getClientIp,
  signAuthProxyRequest,
} from '../src/lib/auth-proxy';
import { isAuthRequestUrl } from '../src/lib/api';
import { GET, POST } from '../src/app/auth-proxy/[...path]/route';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function mockFetch(response: Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  global.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return response;
  }) as typeof fetch;
  return calls;
}

// ---------------------------------------------------------------------------
// getClientIp
// ---------------------------------------------------------------------------

test('getClientIp prioriza x-vercel-forwarded-for sobre los demas', () => {
  const headers = new Headers({
    'x-vercel-forwarded-for': '186.11.74.13',
    'x-forwarded-for': '1.2.3.4',
    'x-real-ip': '5.6.7.8',
  });
  expect(getClientIp(headers)).toBe('186.11.74.13');
});

test('getClientIp usa x-forwarded-for cuando falta x-vercel-forwarded-for', () => {
  const headers = new Headers({
    'x-forwarded-for': '186.11.74.13, 10.0.0.1',
    'x-real-ip': '5.6.7.8',
  });
  expect(getClientIp(headers)).toBe('186.11.74.13');
});

test('getClientIp usa x-real-ip como ultimo recurso', () => {
  const headers = new Headers({ 'x-real-ip': '186.11.74.13' });
  expect(getClientIp(headers)).toBe('186.11.74.13');
});

test('getClientIp toma el primer valor de una lista separada por comas', () => {
  const headers = new Headers({
    'x-vercel-forwarded-for': ' 186.11.74.13 , 56.125.190.173',
  });
  expect(getClientIp(headers)).toBe('186.11.74.13');
});

test('getClientIp devuelve null si ningun header trae una IP valida', () => {
  const headers = new Headers({ 'x-real-ip': 'not-an-ip' });
  expect(getClientIp(headers)).toBeNull();
});

test('getClientIp devuelve null sin headers', () => {
  expect(getClientIp(new Headers())).toBeNull();
});

test('getClientIp soporta IPv6', () => {
  const headers = new Headers({ 'x-vercel-forwarded-for': '2001:db8::1' });
  expect(getClientIp(headers)).toBe('2001:db8::1');
});

// ---------------------------------------------------------------------------
// signAuthProxyRequest
// ---------------------------------------------------------------------------

test('signAuthProxyRequest genera un HMAC-SHA256 hex de 64 caracteres', () => {
  const signature = signAuthProxyRequest(
    'POST',
    '/auth/login',
    '1000',
    '186.11.74.13',
    'secret',
  );
  expect(signature).toMatch(/^[0-9a-f]{64}$/);
});

test('signAuthProxyRequest es determinista', () => {
  const args: [string, string, string, string, string] = [
    'POST',
    '/auth/login',
    '1000',
    '186.11.74.13',
    'secret',
  ];
  expect(signAuthProxyRequest(...args)).toBe(signAuthProxyRequest(...args));
});

test('signAuthProxyRequest cambia si cambia cualquier componente firmado', () => {
  const base = signAuthProxyRequest('POST', '/auth/login', '1000', '186.11.74.13', 'secret');
  expect(signAuthProxyRequest('GET', '/auth/login', '1000', '186.11.74.13', 'secret')).not.toBe(base);
  expect(signAuthProxyRequest('POST', '/auth/me', '1000', '186.11.74.13', 'secret')).not.toBe(base);
  expect(signAuthProxyRequest('POST', '/auth/login', '2000', '186.11.74.13', 'secret')).not.toBe(base);
  expect(signAuthProxyRequest('POST', '/auth/login', '1000', '56.125.190.173', 'secret')).not.toBe(base);
  expect(signAuthProxyRequest('POST', '/auth/login', '1000', '186.11.74.13', 'otro')).not.toBe(base);
});

test('signAuthProxyRequest coincide con la cadena canonica METHOD\\nPATH\\nTIMESTAMP\\nIP', () => {
  const expected = createHmac('sha256', 'secret')
    .update(['POST', '/auth/login?x=1', '1000', '186.11.74.13'].join('\n'))
    .digest('hex');
  expect(
    signAuthProxyRequest('post', '/auth/login?x=1', '1000', '186.11.74.13', 'secret'),
  ).toBe(expected);
});

// ---------------------------------------------------------------------------
// buildForwardHeaders
// ---------------------------------------------------------------------------

test('buildForwardHeaders preserva content-type, cookie, authorization y user-agent', () => {
  const incoming = new Headers({
    'content-type': 'application/json',
    cookie: 'access_token=abc',
    authorization: 'Bearer xyz',
    'user-agent': 'TestAgent/1.0',
  });
  const forwarded = buildForwardHeaders(incoming, {
    clientIp: null,
    timestamp: '1000',
    signature: null,
  });
  expect(forwarded.get('content-type')).toBe('application/json');
  expect(forwarded.get('cookie')).toBe('access_token=abc');
  expect(forwarded.get('authorization')).toBe('Bearer xyz');
  expect(forwarded.get('user-agent')).toBe('TestAgent/1.0');
});

test('buildForwardHeaders elimina headers x-fentri-* enviados por el cliente', () => {
  const incoming = new Headers({
    'x-fentri-client-ip': '9.9.9.9',
    'x-fentri-proxy-timestamp': '1',
    'x-fentri-proxy-signature': 'forged',
  });
  const forwarded = buildForwardHeaders(incoming, {
    clientIp: null,
    timestamp: '1000',
    signature: null,
  });
  expect(forwarded.get('x-fentri-client-ip')).toBeNull();
  expect(forwarded.get('x-fentri-proxy-timestamp')).toBeNull();
  expect(forwarded.get('x-fentri-proxy-signature')).toBeNull();
});

test('buildForwardHeaders no copia headers fuera del allowlist', () => {
  const incoming = new Headers({
    host: 'frontend.vercel.app',
    'content-length': '123',
    'x-random-header': 'nope',
  });
  const forwarded = buildForwardHeaders(incoming, {
    clientIp: null,
    timestamp: '1000',
    signature: null,
  });
  expect(forwarded.get('host')).toBeNull();
  expect(forwarded.get('content-length')).toBeNull();
  expect(forwarded.get('x-random-header')).toBeNull();
});

test('buildForwardHeaders agrega x-fentri-* solo cuando hay IP y firma', () => {
  const withSignature = buildForwardHeaders(new Headers(), {
    clientIp: '186.11.74.13',
    timestamp: '1000',
    signature: 'abc123',
  });
  expect(withSignature.get('x-fentri-client-ip')).toBe('186.11.74.13');
  expect(withSignature.get('x-fentri-proxy-timestamp')).toBe('1000');
  expect(withSignature.get('x-fentri-proxy-signature')).toBe('abc123');

  const withoutSignature = buildForwardHeaders(new Headers(), {
    clientIp: '186.11.74.13',
    timestamp: '1000',
    signature: null,
  });
  expect(withoutSignature.get('x-fentri-client-ip')).toBeNull();
});

// ---------------------------------------------------------------------------
// copyResponseHeaders
// ---------------------------------------------------------------------------

test('copyResponseHeaders preserva multiples Set-Cookie sin combinarlos', () => {
  const source = new Headers();
  source.append('set-cookie', 'access_token=abc; Path=/; HttpOnly');
  source.append('set-cookie', 'refresh_token=def; Path=/; HttpOnly');
  source.set('content-type', 'application/json');

  const target = new Headers();
  copyResponseHeaders(source, target);

  expect(target.getSetCookie()).toEqual([
    'access_token=abc; Path=/; HttpOnly',
    'refresh_token=def; Path=/; HttpOnly',
  ]);
  expect(target.get('content-type')).toBe('application/json');
});

test('copyResponseHeaders excluye headers hop-by-hop', () => {
  const source = new Headers({
    'content-length': '42',
    'transfer-encoding': 'chunked',
    connection: 'keep-alive',
    'content-type': 'application/json',
  });
  const target = new Headers();
  copyResponseHeaders(source, target);

  expect(target.get('content-length')).toBeNull();
  expect(target.get('transfer-encoding')).toBeNull();
  expect(target.get('connection')).toBeNull();
  expect(target.get('content-type')).toBe('application/json');
});

// ---------------------------------------------------------------------------
// Route handler (mocked fetch, no backend/red real)
// ---------------------------------------------------------------------------

test.describe('route handler', () => {
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'https://backend.example.com';
    process.env.AUTH_PROXY_HMAC_SECRET = 'test-secret';
  });

  test.afterEach(() => {
    restoreEnv();
    global.fetch = ORIGINAL_FETCH;
  });

  test('preserva query string y llega a la URL de backend esperada', async () => {
    const calls = mockFetch(new Response(null, { status: 200 }));

    const request = new NextRequest(
      'http://localhost:3000/auth-proxy/auth/sessions/revoke-others?foo=bar',
      { method: 'POST' },
    );

    await POST(request, { params: Promise.resolve({ path: ['auth', 'sessions', 'revoke-others'] }) });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://backend.example.com/auth/sessions/revoke-others?foo=bar',
    );
  });

  test('preserva body y content-type en POST', async () => {
    const calls = mockFetch(new Response(null, { status: 201 }));

    const payload = JSON.stringify({ email: 'a@b.com', password: 'x' });
    const request = new NextRequest('http://localhost:3000/auth-proxy/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });

    await POST(request, { params: Promise.resolve({ path: ['auth', 'login'] }) });

    const init = calls[0].init as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('content-type')).toBe('application/json');
    expect(Buffer.from(init.body as ArrayBuffer).toString('utf8')).toBe(payload);
  });

  test('preserva cookies y authorization', async () => {
    const calls = mockFetch(new Response(null, { status: 200 }));

    const request = new NextRequest('http://localhost:3000/auth-proxy/auth/me', {
      method: 'GET',
      headers: {
        cookie: 'access_token=abc',
        authorization: 'Bearer xyz',
      },
    });

    await GET(request, { params: Promise.resolve({ path: ['auth', 'me'] }) });

    const headers = (calls[0].init as RequestInit).headers as Headers;
    expect(headers.get('cookie')).toBe('access_token=abc');
    expect(headers.get('authorization')).toBe('Bearer xyz');
  });

  test('reenvia correctamente uno o varios Set-Cookie de la respuesta', async () => {
    const backendHeaders = new Headers();
    backendHeaders.append('set-cookie', 'access_token=abc; Path=/; HttpOnly');
    backendHeaders.append('set-cookie', 'other=1; Path=/');
    mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200, headers: backendHeaders }));

    const request = new NextRequest('http://localhost:3000/auth-proxy/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    const response = await POST(request, { params: Promise.resolve({ path: ['auth', 'login'] }) });

    expect(response.headers.getSetCookie()).toEqual([
      'access_token=abc; Path=/; HttpOnly',
      'other=1; Path=/',
    ]);
  });

  test('firma la IP cuando Vercel entrega un header de IP valido', async () => {
    const calls = mockFetch(new Response(null, { status: 200 }));

    const request = new NextRequest('http://localhost:3000/auth-proxy/auth/me', {
      method: 'GET',
      headers: { 'x-vercel-forwarded-for': '186.11.74.13' },
    });

    await GET(request, { params: Promise.resolve({ path: ['auth', 'me'] }) });

    const headers = (calls[0].init as RequestInit).headers as Headers;
    expect(headers.get('x-fentri-client-ip')).toBe('186.11.74.13');
    expect(headers.get('x-fentri-proxy-timestamp')).toBeTruthy();
    expect(headers.get('x-fentri-proxy-signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  test('no agrega headers x-fentri-* cuando no hay IP de Vercel disponible', async () => {
    const calls = mockFetch(new Response(null, { status: 200 }));

    const request = new NextRequest('http://localhost:3000/auth-proxy/auth/me', {
      method: 'GET',
    });

    await GET(request, { params: Promise.resolve({ path: ['auth', 'me'] }) });

    const headers = (calls[0].init as RequestInit).headers as Headers;
    expect(headers.get('x-fentri-client-ip')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Enrutamiento /auth/* vs /api-proxy
// ---------------------------------------------------------------------------

test('isAuthRequestUrl acepta rutas /auth/*', () => {
  expect(isAuthRequestUrl('/auth/login')).toBe(true);
  expect(isAuthRequestUrl('/auth/me')).toBe(true);
  expect(isAuthRequestUrl('/auth')).toBe(true);
});

test('isAuthRequestUrl rechaza rutas fuera de /auth (siguen usando /api-proxy)', () => {
  expect(isAuthRequestUrl('/assets')).toBe(false);
  expect(isAuthRequestUrl('/authorization')).toBe(false);
  expect(isAuthRequestUrl(undefined)).toBe(false);
});
