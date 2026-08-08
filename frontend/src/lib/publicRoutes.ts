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
const ALWAYS_PUBLIC_PATH_PREFIXES = ["/share/", "/register"];

export function isAlwaysPublicPath(pathname: string): boolean {
  return ALWAYS_PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Guest-only routes: meant to be usable while logged out (unlike
 * isAlwaysPublicPath, AuthContext still redirects *away* from these to the
 * dashboard once a session exists — no reason to see the login form again).
 *
 * Shared with the axios 401 interceptor for the same reason as
 * isAlwaysPublicPath above: the ambient /auth/me check on page mount 401s
 * for anyone who isn't logged in, which is the expected state on these
 * pages, not a session expiry — without this exemption the interceptor's
 * hard `window.location.href = "/login"` fired on every fresh visit to
 * /signup, /forgot-password or /reset-password before the visitor could do
 * anything.
 */
const GUEST_ONLY_PATHS = ["/login", "/", "/forgot-password", "/reset-password", "/signup"];

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.includes(pathname);
}

/** Either kind of path where a background 401 must never force a redirect. */
export function isAuthRedirectExemptPath(pathname: string): boolean {
  return isAlwaysPublicPath(pathname) || isGuestOnlyPath(pathname);
}
