import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getSessionToken } from '@/lib/auth/session-token';
import { can, type Capability } from '@/lib/auth/permissions';

// All authenticated dashboard roles (incl. legacy 'guest'). requireCap admits
// any authenticated session here, then enforces the capability via the matrix.
const ALL_DASHBOARD_ROLES = ['admin', 'manager', 'staff', 'viewer', 'guest'];

type AuthUser = { id: string; role: string; username: string; email: string };

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '');

/**
 * Verify the supplier httpOnly cookie (rel_supplier_token).
 * Returns decoded payload or null.
 */
export async function verifySupplierToken(
  req: NextRequest
): Promise<{ supplier_id: string; role: string; email: string } | null> {
  const token = req.cookies.get('rel_supplier_token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (
      payload &&
      typeof payload.supplier_id === 'string' &&
      payload.role === 'supplier'
    ) {
      return {
        supplier_id: payload.supplier_id,
        role: payload.role,
        email: (payload.email as string) ?? '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify the buyer httpOnly cookie (rel_buyer_token).
 * Returns decoded payload or null.
 */
export async function verifyBuyerToken(
  req: NextRequest
): Promise<{ buyer_id: string; role: string; email: string } | null> {
  const token = req.cookies.get('rel_buyer_token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (
      payload &&
      typeof payload.buyer_id === 'string' &&
      payload.role === 'buyer'
    ) {
      return {
        buyer_id: payload.buyer_id,
        role: payload.role,
        email: (payload.email as string) ?? '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * requireAuth — check NextAuth JWT for admin/staff role.
 * Returns the decoded token or a 401/403 response.
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles: string[] = ['admin', 'staff']
): Promise<
  | { id: string; role: string; username: string; email: string }
  | NextResponse
> {
  const token = await getSessionToken(req);

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!allowedRoles.includes(token.role as string)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  return {
    id: token.id as string,
    role: token.role as string,
    username: token.username as string,
    email: token.email as string,
  };
}

/**
 * requireSupplierAuth — check the supplier httpOnly cookie.
 * Returns the decoded supplier payload or a 401 response.
 */
export async function requireSupplierAuth(
  req: NextRequest
): Promise<
  | { supplier_id: string; role: string; email: string }
  | NextResponse
> {
  const payload = await verifySupplierToken(req);
  if (!payload) {
    return NextResponse.json({ error: 'Supplier authentication required' }, { status: 401 });
  }
  return payload;
}

/**
 * isAuthResult — type guard: returns true if value is user payload, not NextResponse.
 */
export function isAuthResult<T>(
  result: T | NextResponse
): result is T {
  return !(result instanceof NextResponse);
}

/**
 * requireCap — capability-based gate (the four-tier role model). Admits any
 * authenticated dashboard session, then enforces the capability via the central
 * permission matrix (src/lib/auth/permissions.ts). Returns the user payload or a
 * 401 (no session) / 403 (insufficient permission) response.
 *
 * Use this EVERYWHERE instead of hand-written role-string lists.
 */
export async function requireCap(
  req: NextRequest,
  capability: Capability
): Promise<AuthUser | NextResponse> {
  const auth = await requireAuth(req, ALL_DASHBOARD_ROLES);
  if (!isAuthResult(auth)) return auth; // 401 — not authenticated
  if (!can(auth.role, capability)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  return auth;
}
