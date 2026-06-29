/**
 * Returns true only for safe internal paths that can be used as redirect destinations.
 *
 * Rejects:
 * - null / undefined / non-strings
 * - paths that don't start with "/"
 * - protocol-relative URLs ("//evil.com")
 * - URL-encoded variants of the above ("%2F%2Fevil.com")
 * - backslash variants that URL parsers may normalize
 * - malformed percent-encoding
 * - paths that would create login redirect loops
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path || typeof path !== 'string') return false;
  if (!path.startsWith('/')) return false;

  // Reject protocol-relative URLs
  if (path.startsWith('//')) return false;
  if (path.includes('\\')) return false;

  // Reject URL-encoded variants (%2F%2F -> //)
  try {
    const decoded = decodeURIComponent(path);
    if (!decoded.startsWith('/')) return false;
    if (decoded.startsWith('//')) return false;
    if (decoded.includes('\\')) return false;
  } catch {
    return false;
  }

  // Reject paths that would cause a redirect loop back to login
  if (
    path === '/login' ||
    path.startsWith('/login?') ||
    path.startsWith('/login/')
  ) {
    return false;
  }

  return true;
}
