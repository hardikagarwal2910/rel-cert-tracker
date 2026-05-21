import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifySupplierToken } from '@/lib/auth/middleware';

// Public routes that require no authentication
const PUBLIC_ROUTES = [
  '/login',
  '/supplier/login',
  '/supplier/accept-invite',
  '/api/auth',
  '/api/supplier-auth',
  '/api/download',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Always allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Supplier portal routes — verify supplier JWT cookie
  if (pathname.startsWith('/supplier/') || pathname.startsWith('/api/supplier-certs')) {
    const supplierPayload = await verifySupplierToken(req);
    if (!supplierPayload) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Supplier authentication required' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/supplier/login', req.url));
    }

    // Attach supplier_id as a request header for downstream route handlers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-supplier-id', supplierPayload.supplier_id);
    requestHeaders.set('x-supplier-email', supplierPayload.email);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Dashboard and admin API routes — verify NextAuth JWT
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/(dashboard)') || pathname.startsWith('/api/')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-role', token.role as string);
    requestHeaders.set('x-user-name', token.username as string);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
