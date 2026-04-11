import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // const pathname = request.nextUrl.pathname;
  
  // // Auth Temporarily Disabled for Assets phase
  // /*
  // if (pathname.startsWith('/admin')) {
  //   const token = request.cookies.get('access_token')?.value;

  //   if (!token) {
  //     const url = new URL('/login', request.url);
  //     return NextResponse.redirect(url);
  //   }
  // }

  // if (pathname === '/login') {
  //   const token = request.cookies.get('access_token')?.value;
  //   if (token) {
  //     const url = new URL('/admin', request.url);
  //     return NextResponse.redirect(url);
  //   }
  // }
  // */

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/assets/:path*', '/login'],
};
