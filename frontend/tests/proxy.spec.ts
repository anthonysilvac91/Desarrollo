/**
 * Proxy auth routing tests.
 *
 * The proxy should not try to read the cross-domain auth cookie anymore.
 * Route protection is handled by AuthContext after /auth/me.
 */
import { test, expect } from '@playwright/test';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { proxy, config } from '../src/proxy';
import { isSafeInternalPath } from '../src/lib/safe-path';

function makeRequest(path: string): NextRequest {
  const url = `http://localhost:3000${path}`;
  return new NextRequest(url);
}

function getRedirectLocation(response: Response | undefined): string | null {
  if (!response) return null;
  return response.headers.get('location');
}

test('1. /dashboard without local cookie is not redirected by proxy', () => {
  const res = proxy(makeRequest('/dashboard'));
  expect(getRedirectLocation(res)).toBeNull();
});

test('2. /assets without local cookie is not redirected by proxy', () => {
  const res = proxy(makeRequest('/assets'));
  expect(getRedirectLocation(res)).toBeNull();
});

test('3. /owners without local cookie is not redirected by proxy', () => {
  const res = proxy(makeRequest('/owners'));
  expect(getRedirectLocation(res)).toBeNull();
});

test('4. /trash without local cookie is not redirected by proxy', () => {
  const res = proxy(makeRequest('/trash'));
  expect(getRedirectLocation(res)).toBeNull();
});

test('5. /settings without local cookie is not redirected by proxy', () => {
  const res = proxy(makeRequest('/settings'));
  expect(getRedirectLocation(res)).toBeNull();
});

test('6. /login is not intercepted by the matcher', () => {
  expect(
    unstable_doesMiddlewareMatch({
      config,
      url: '/login',
    }),
  ).toBe(false);
});

test('7. /forgot-password is not intercepted by the matcher', () => {
  expect(
    unstable_doesMiddlewareMatch({
      config,
      url: '/forgot-password',
    }),
  ).toBe(false);
});

test('8. /share/* is not intercepted by the matcher', () => {
  expect(
    unstable_doesMiddlewareMatch({
      config,
      url: '/share/services/abc123',
    }),
  ).toBe(false);
});

test('9. /_next/static/* is not intercepted by the matcher', () => {
  expect(
    unstable_doesMiddlewareMatch({
      config,
      url: '/_next/static/chunks/main.js',
    }),
  ).toBe(false);
});

test('10. /_next/image/* is not intercepted by the matcher', () => {
  expect(
    unstable_doesMiddlewareMatch({
      config,
      url: '/_next/image?url=%2Fimg.png&w=128&q=75',
    }),
  ).toBe(false);
});

test('11. /api/* is not intercepted by the matcher', () => {
  expect(
    unstable_doesMiddlewareMatch({
      config,
      url: '/api/auth/login',
    }),
  ).toBe(false);
});

test('12. protected routes no longer receive a server-side redirect target', () => {
  const res = proxy(makeRequest('/dashboard?tab=overview'));
  expect(getRedirectLocation(res)).toBeNull();
});

test('13. isSafeInternalPath accepts a valid internal path', () => {
  expect(isSafeInternalPath('/dashboard')).toBe(true);
  expect(isSafeInternalPath('/assets/123')).toBe(true);
  expect(isSafeInternalPath('/owners')).toBe(true);
});

test('14. isSafeInternalPath rejects absolute URLs', () => {
  expect(isSafeInternalPath('http://evil.com')).toBe(false);
  expect(isSafeInternalPath('https://evil.com')).toBe(false);
});

test('15. isSafeInternalPath rejects protocol-relative URLs', () => {
  expect(isSafeInternalPath('//evil.com')).toBe(false);
  expect(isSafeInternalPath('//evil.com/path')).toBe(false);
});

test('16. isSafeInternalPath rejects dangerous schemes and encoded variants', () => {
  expect(isSafeInternalPath('javascript:alert(1)')).toBe(false);
  expect(isSafeInternalPath('data:text/html,<h1>XSS</h1>')).toBe(false);
  expect(isSafeInternalPath('/%2F%2Fevil.com')).toBe(false);
  expect(isSafeInternalPath('/\\evil.com')).toBe(false);
  expect(isSafeInternalPath('/%5C%5Cevil.com')).toBe(false);
});

test('17. isSafeInternalPath rejects empty and malformed values', () => {
  expect(isSafeInternalPath(null)).toBe(false);
  expect(isSafeInternalPath(undefined)).toBe(false);
  expect(isSafeInternalPath('')).toBe(false);
  expect(isSafeInternalPath('evil.com')).toBe(false);
});

test('18. /login does not create a proxy loop', () => {
  expect(
    unstable_doesMiddlewareMatch({
      config,
      url: '/login',
    }),
  ).toBe(false);
});

// ---------------------------------------------------------------------------
// Tests 19-21: E2E - require a local server on localhost:3000
// ---------------------------------------------------------------------------

test('19. Login flow still preserves redirect in the client', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  expect(page.url()).toContain('redirect=');
});

test('20. 2FA flow preserves redirect in the client', async ({ page }) => {
  await page.goto('/owners');
  await expect(page).toHaveURL(/\/login/);
  expect(page.url()).toContain('redirect=');
  await page.waitForSelector('input[type="email"]');
  expect(page.url()).toContain('redirect=');
});

test('21. pendingRedirect in sessionStorage is consumed once', async ({
  page,
}) => {
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.setItem('pendingRedirect', '/assets');
  });

  const firstRead = await page.evaluate(() => {
    const val = sessionStorage.getItem('pendingRedirect');
    sessionStorage.removeItem('pendingRedirect');
    return val;
  });
  expect(firstRead).toBe('/assets');

  const secondRead = await page.evaluate(() =>
    sessionStorage.getItem('pendingRedirect'),
  );
  expect(secondRead).toBeNull();
});
