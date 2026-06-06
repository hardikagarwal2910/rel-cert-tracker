/**
 * Global search — data layer + API route.
 */

import { NextRequest } from 'next/server';

let mockRows: Array<Record<string, unknown>> = [];
let fromCalls = 0;

jest.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'or', 'ilike', 'limit', 'eq', 'order']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.from = jest.fn(() => {
    fromCalls++;
    return chain;
  });
  (chain as { then: unknown }).then = (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: mockRows, error: null }).then(onFulfilled);
  return { adminClient: chain };
});

jest.mock('@/lib/auth/middleware', () => ({
  requireCap: jest.fn(async (req, cap) => { const role = req.headers.get("x-user-role"); const id = req.headers.get("x-user-id"); const username = req.headers.get("x-user-name") ?? "testuser"; const { NextResponse } = require("next/server"); if (!id || !role) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); const { can } = jest.requireActual("@/lib/auth/permissions"); if (!can(role, cap)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }); return { id, role, username, email: username + "@test.com" }; }),
  
  requireAuth: jest.fn(async (req: { headers: { get: (k: string) => string | null } }, roles: string[] = ['admin', 'staff']) => {
    const id = req.headers.get('x-user-id');
    const role = req.headers.get('x-user-role');
    if (!id || !role) {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!roles.includes(role)) {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return { id, role, username: 'hardik', email: 'h@test.com' };
  }),
  isAuthResult: jest.fn((r: unknown) => !(r && typeof r === 'object' && 'headers' in r)),
  requireSupplierAuth: jest.fn(),
  verifySupplierToken: jest.fn(),
}));

import { globalSearch } from '@/lib/db/search';

function adminReq(url: string) {
  return new NextRequest(url, {
    headers: { 'x-user-id': 'user-001', 'x-user-role': 'admin', 'x-user-name': 'hardik' },
  });
}

describe('globalSearch', () => {
  beforeEach(() => {
    fromCalls = 0;
    mockRows = [{ id: '1', name: 'ISO 9001' }];
  });

  it('returns grouped results for a non-blank query', async () => {
    const res = await globalSearch('ISO');
    expect(res.certificates.length).toBeGreaterThan(0);
    expect(res.suppliers.length).toBeGreaterThan(0);
    expect(res.locations.length).toBeGreaterThan(0);
  });

  it('returns empty groups for a blank query WITHOUT querying', async () => {
    fromCalls = 0;
    const res = await globalSearch('   ');
    expect(res.certificates).toEqual([]);
    expect(res.suppliers).toEqual([]);
    expect(res.locations).toEqual([]);
    expect(fromCalls).toBe(0); // no DB query issued
  });
});

describe('GET /api/search', () => {
  beforeEach(() => {
    mockRows = [{ id: '1', name: 'ISO 9001' }];
  });

  it('without auth → 401', async () => {
    const { GET } = require('@/app/api/search/route');
    const res = await GET(new NextRequest('http://localhost/api/search?q=iso'));
    expect(res.status).toBe(401);
  });

  it('admin → 200 grouped results', async () => {
    const { GET } = require('@/app/api/search/route');
    const res = await GET(adminReq('http://localhost/api/search?q=iso'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('certificates');
    expect(body).toHaveProperty('suppliers');
    expect(body).toHaveProperty('locations');
  });
});
