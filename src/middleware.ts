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

// ── CORS ──────────────────────────────────────────────────────────────────────
// Only the configured app origin is allowed to make credentialed cross-origin
// requests. We never use a wildcard origin together with credentials.
function isOriginAllowed(origin: string | null): origin is string {
  const allowed = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return !!origin && !!allowed && origin === allowed;
}

function applyCorsHeaders(res: NextResponse, origin: string): void {
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Vary', 'Origin');
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');
  const isApi = pathname.startsWith('/api/');
  const originAllowed = isOriginAllowed(origin);

  // Handle CORS preflight for API routes before auth checks.
  if (isApi && req.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    if (originAllowed) applyCorsHeaders(res, origin);
    return res;
  }

  const withCors = (res: NextResponse): NextResponse => {
    if (isApi && originAllowed) applyCorsHeaders(res, origin);
    return res;
  };

  // Always allow public routes
  if (isPublicRoute(pathname)) {
    return withCors(NextResponse.next());
  }

  // Supplier portal routes — verify supplier JWT cookie
  if (pathname.startsWith('/supplier/') || pathname.startsWith('/api/supplier-certs')) {
    const supplierPayload = await verifySupplierToken(req);
    if (!supplierPayload) {
      if (pathname.startsWith('/api/')) {
        return withCors(NextResponse.json({ error: 'Supplier authentication required' }, { status: 401 }));
      }
      return NextResponse.redirect(new URL('/supplier/login', req.url));
    }

    // Attach supplier_id as a request header for downstream route handlers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-supplier-id', supplierPayload.supplier_id);
    requestHeaders.set('x-supplier-email', supplierPayload.email);
    return withCors(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Dashboard and admin API routes — verify NextAuth JWT
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/(dashboard)') || pathname.startsWith('/api/')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      if (pathname.startsWith('/api/')) {
        return withCors(NextResponse.json({ error: 'Authentication required' }, { status: 401 }));
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', token.id as string);
    requestHeaders.set('x-user-role', token.role as string);
    requestHeaders.set('x-user-name', token.username as string);
    return withCors(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  return withCors(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
