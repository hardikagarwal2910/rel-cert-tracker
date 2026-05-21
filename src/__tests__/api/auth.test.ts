/**
 * Auth API tests — supplier login, me, logout, rate limiting
 */

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

// ─── Mock dependencies ────────────────────────────────────────────────────────

// Mock auth middleware — reads role from x-user-role header
jest.mock('@/lib/auth/middleware', () => ({
  requireAuth: jest.fn(async (req: { headers: { get: (k: string) => string | null } }, roles: string[] = ['admin', 'staff']) => {
    const id = req.headers.get('x-user-id');
    const role = req.headers.get('x-user-role');
    const username = req.headers.get('x-user-name') ?? 'testuser';
    if (!id || !role) {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!roles.includes(role)) {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return { id, role, username, email: `${username}@test.com` };
  }),
  requireSupplierAuth: jest.fn(async (req: { headers: { get: (k: string) => string | null } }) => {
    const supplierId = req.headers.get('x-supplier-id');
    if (!supplierId) {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'Supplier authentication required' }, { status: 401 });
    }
    return { supplier_id: supplierId, role: 'supplier', email: 'supplier@test.com' };
  }),
  isAuthResult: jest.fn((result: unknown) => !(result && typeof result === 'object' && 'headers' in result)),
  verifySupplierToken: jest.fn(),
}));

// Mock supabase admin (prevent real connections)
jest.mock('@/lib/supabase/admin', () => ({
  adminClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

const VALID_HASH = bcrypt.hashSync('password123', 10);

// Mock getSuppliers to return controlled data
jest.mock('@/lib/db/suppliers', () => ({
  getSuppliers: jest.fn(),
  getSupplierById: jest.fn(),
  updateSupplier: jest.fn().mockResolvedValue({}),
  getSupplierScorecard: jest.fn().mockResolvedValue({}),
  createSupplier: jest.fn(),
}));

jest.mock('@/lib/db/audit-log', () => ({
  appendAuditLog: jest.fn(),
  getAuditLog: jest.fn().mockResolvedValue([]),
  exportAuditLogCsv: jest.fn().mockResolvedValue(''),
}));

jest.mock('@/lib/encryption', () => ({
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => {
    if (v.startsWith('enc:')) return v.slice(4);
    return v;
  }),
}));

// Reset rate-limit store between test suites
jest.mock('@/lib/rate-limit', () => {
  const store = new Map<string, { count: number; resetAt: number }>();
  function createLimiter(prefix: string, max: number, windowMs: number) {
    return (req: { headers: { get: (k: string) => string | null } }) => {
      const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
      const key = `${prefix}:${ip}`;
      const now = Date.now();
      const state = store.get(key);
      if (!state || now > state.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return null;
      }
      if (state.count >= max) {
        const { NextResponse } = require('next/server');
        return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
      }
      state.count++;
      return null;
    };
  }
  return {
    loginLimiter: createLimiter('login', 5, 15 * 60 * 1000),
    backupLimiter: createLimiter('backup', 1, 60 * 60 * 1000),
    ocrLimiter: createLimiter('ocr', 20, 60 * 60 * 1000),
    downloadLimiter: createLimiter('download', 10, 60 * 1000),
    adminLimiter: createLimiter('admin', 100, 15 * 60 * 1000),
    _store: store,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(url, init);
}

const ACTIVE_SUPPLIER = {
  id: 'sup-001',
  name: 'Test Supplier Ltd',
  contacts: [{ name: 'John', email: 'enc:john@test.com', phone: '' }],
  portal_login: {
    email: 'enc:john@test.com',
    password_hash: VALID_HASH,
    invite_accepted: true,
  },
  onboarding_checklist: {},
  status: 'active',
};

const INACTIVE_SUPPLIER = {
  ...ACTIVE_SUPPLIER,
  id: 'sup-inactive',
  portal_login: {
    email: 'enc:inactive@test.com',
    password_hash: VALID_HASH,
    invite_accepted: true,
    active: false,
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/supplier-auth/login', () => {
  const { getSuppliers } = require('@/lib/db/suppliers');

  beforeEach(() => {
    getSuppliers.mockResolvedValue([ACTIVE_SUPPLIER, INACTIVE_SUPPLIER]);
  });

  it('correct credentials → 200 + httpOnly cookie, no token in body', async () => {
    const { POST } = require('@/app/api/supplier-auth/login/route');

    const req = makeRequest('http://localhost/api/supplier-auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '10.0.0.1',
      },
      body: JSON.stringify({ email: 'john@test.com', password: 'password123' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).not.toHaveProperty('token');
    expect(body).toHaveProperty('supplier_id', 'sup-001');
    expect(body).toHaveProperty('name', 'Test Supplier Ltd');

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('rel_supplier_token');
    expect(setCookie?.toLowerCase()).toContain('httponly');
    expect(setCookie?.toLowerCase()).toContain('samesite=strict');
  });

  it('wrong password → 401', async () => {
    const { POST } = require('@/app/api/supplier-auth/login/route');

    const req = makeRequest('http://localhost/api/supplier-auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '10.0.0.2',
      },
      body: JSON.stringify({ email: 'john@test.com', password: 'wrongpassword' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body).not.toHaveProperty('password_hash');
    expect(body).not.toHaveProperty('token');
  });

  it('unknown email → 401', async () => {
    const { POST } = require('@/app/api/supplier-auth/login/route');

    const req = makeRequest('http://localhost/api/supplier-auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '10.0.0.3',
      },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'password123' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('missing fields → 400', async () => {
    const { POST } = require('@/app/api/supplier-auth/login/route');

    const req = makeRequest('http://localhost/api/supplier-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.4' },
      body: JSON.stringify({ email: '' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('without auth headers → 401', async () => {
    const { GET } = require('@/app/api/auth/me/route');

    const req = makeRequest('http://localhost/api/auth/me');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('with x-user-id header → 200 with user info', async () => {
    const { GET } = require('@/app/api/auth/me/route');

    const req = makeRequest('http://localhost/api/auth/me', {
      headers: {
        'x-user-id': 'user-001',
        'x-user-role': 'admin',
        'x-user-name': 'hardik',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id', 'user-001');
    expect(body).toHaveProperty('role', 'admin');
    expect(body).toHaveProperty('username', 'hardik');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears session and supplier cookies → 200', async () => {
    const { POST } = require('@/app/api/auth/logout/route');

    const req = makeRequest('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { 'x-user-name': 'hardik', 'x-forwarded-for': '127.0.0.1' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
  });
});

describe('Rate limiter — login endpoint', () => {
  it('blocks after 5 rapid attempts from same IP', async () => {
    // Use a unique IP to isolate from other tests
    const ip = '192.168.100.100';
    const { POST } = require('@/app/api/supplier-auth/login/route');
    const { getSuppliers } = require('@/lib/db/suppliers');
    getSuppliers.mockResolvedValue([]);

    const makeLoginReq = () =>
      makeRequest('http://localhost/api/supplier-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ email: 'x@x.com', password: 'password123' }),
      });

    // 5 attempts should be allowed (returning 401 for bad creds, not 429)
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeLoginReq());
      expect(res.status).not.toBe(429);
    }

    // 6th attempt must be rate-limited
    const res = await POST(makeLoginReq());
    expect(res.status).toBe(429);
  });
});
