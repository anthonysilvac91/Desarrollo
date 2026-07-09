/**
 * Routes that must render for anyone, regardless of auth state — no
 * redirect to /login on a background 401, no redirect away if the viewer
 * happens to be logged in (e.g. an admin previewing their own share link).
 *
 * This is the single source of truth for "always public" paths. It's
 * consulted from two places that used to disagree: AuthContext's route
 * guard (which knew about /share/) and the axios 401 interceptor (which
 * only checked the failed *request* URL, not the *page* the viewer was on)
 * — an ambient /auth/me check firing on page load would 401 and force a
 * hard redirect to /login even while sitting on a public share page.
 */
const ALWAYS_PUBLIC_PATH_PREFIXES = ["/share/"];

export function isAlwaysPublicPath(pathname: string): boolean {
  return ALWAYS_PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
