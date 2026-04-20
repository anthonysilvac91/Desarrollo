import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('access_token')?.value;

  // Rutas que requieren autenticación
  const isProtectedRoute = 
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/assets') || 
    pathname.startsWith('/users') || 
    pathname.startsWith('/settings') || 
    pathname.startsWith('/service') || 
    pathname.startsWith('/app') || 
    pathname.startsWith('/master');

  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    // Preservar la URL original para volver después del login (opcional)
    // loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Si ya tiene token y va a login, mandarlo al home (AuthContext decidirá el landing final)
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
    '/login'
  ],
};
