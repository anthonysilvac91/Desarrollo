import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('access_token')?.value;

  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/service') ||
    pathname.startsWith('/app') ||
    pathname.startsWith('/master');

  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/assets/:path*',
    '/users/:path*',
    '/settings/:path*',
    '/service/:path*',
    '/app/:path*',
    '/master/:path*',
    '/login',
  ],
};
