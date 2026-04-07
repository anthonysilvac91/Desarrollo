import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Si la ruta solicitada empieza con /admin, necesita protección
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('access_token')?.value;

    if (!token) {
      // Redirigir al login si no hay token
      const url = new URL('/login', request.url);
      return NextResponse.redirect(url);
    }
  }

  // Si intentamos ir a login y ya estamos autenticados, mandar al admin
  if (pathname === '/login') {
    const token = request.cookies.get('access_token')?.value;
    if (token) {
      const url = new URL('/admin', request.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Configurar las rutas que deben ser procesadas
  matcher: ['/admin/:path*', '/login'],
};
