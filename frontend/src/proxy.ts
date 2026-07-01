import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSafeInternalPath } from "./lib/safe-path";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/assets",
  "/service",
  "/owners",
  "/users",
  "/organizations",
  "/settings",
  "/trash",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    const redirectTarget = `${pathname}${search}`;
    if (isSafeInternalPath(redirectTarget)) {
      loginUrl.searchParams.set("redirect", redirectTarget);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/assets/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/service/:path*",
    "/organizations/:path*",
    "/owners/:path*",
    "/trash/:path*",
  ],
};
