import { NextRequest, NextResponse } from 'next/server';
import { verifySupplierToken, verifyBuyerToken } from '@/lib/auth/middleware';
import { getSessionToken } from '@/lib/auth/session-token';

// Public routes that require no authentication
const PUBLIC_ROUTES = [
  '/login',
  '/supplier/login',
  '/supplier/accept-invite',
  '/buyer/login',
  '/buyer/register',
  '/buyer/set-password',
  '/api/auth',
  '/api/supplier-auth',
  '/api/buyer-auth',
  '/api/download',
  // POST (buyer request) + token-gated approve/deny email links are
  // authless by design; the GET list still enforces admin in-handler.
  '/api/pdf-requests',
  // Vercel cron hits this with only the CRON_SECRET (no session); the route
  // self-gates via the secret. The POST manual trigger still calls requireAuth.
  '/api/cron',
];

function isPublicRoute(pathname: string): boolean {
  // /api/auth/me needs the authenticated session headers — it must NOT be
  // treated as public even though it starts with the /api/auth prefix.
  if (pathname === '/api/auth/me') return false;
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

// Supplier portal pages are served at root-level routes from the
// (supplier-portal) route group and authenticate themselves via the
// rel_supplier_token cookie — they must NOT be gated by the admin session check.
const SUPPLIER_PORTAL_PAGES = ['/dashboard', '/my-certs', '/required', '/upload'];
function isSupplierPortalPage(pathname: string): boolean {
  return SUPPLIER_PORTAL_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'));
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

  // Buyer portal routes — verify buyer JWT cookie
  if (pathname.startsWith('/buyer-portal')) {
    const buyerPayload = await verifyBuyerToken(req);
    if (!buyerPayload) {
      return NextResponse.redirect(new URL('/buyer/login', req.url));
    }
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-buyer-id', buyerPayload.buyer_id);
    requestHeaders.set('x-buyer-email', buyerPayload.email);
    return withCors(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Supplier portal pages self-authenticate via their own cookie — pass through.
  if (isSupplierPortalPage(pathname)) {
    return withCors(NextResponse.next());
  }

  // Everything else is a protected admin/staff surface: the dashboard pages
  // (served from the (dashboard) route group at root level — /, /certificates,
  // /suppliers, …) and the admin API routes. All require a NextAuth session.
  const token = await getSessionToken(req);

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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
