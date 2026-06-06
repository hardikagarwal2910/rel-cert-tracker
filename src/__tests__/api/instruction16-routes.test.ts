/**
 * v1.1.4 — Add Staff User UI + missing-control sweep (route layer).
 * Covers POST /api/users (staff create, role gating, duplicate, admin-role
 * rejection), PATCH /api/users/[id] password reset, and POST /api/suppliers.
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/middleware', () => ({
  requireCap: jest.fn(async (req, cap) => { const role = req.headers.get("x-user-role"); const id = req.headers.get("x-user-id"); const username = req.headers.get("x-user-name") ?? "testuser"; const { NextResponse } = require("next/server"); if (!id || !role) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); const { can } = jest.requireActual("@/lib/auth/permissions"); if (!can(role, cap)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }); return { id, role, username, email: username + "@test.com" }; }),
  
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
  isAuthResult: jest.fn((r: unknown) => !(r && typeof r === 'object' && 'headers' in r)),
  requireSupplierAuth: jest.fn(),
  verifySupplierToken: jest.fn(),
}));

jest.mock('@/lib/db/users', () => ({
  getUsers: jest.fn().mockResolvedValue([]),
  getUserByUsername: jest.fn().mockResolvedValue(null), // no duplicate by default
  getUserById: jest.fn().mockResolvedValue({ id: 'u-1', username: 'someone', role: 'staff' }),
  createUser: jest.fn().mockResolvedValue({ id: 'u-new', username: 'newstaff', role: 'staff', display_name: 'New Staff', password_hash: 'HASH', active: true }),
  updateUser: jest.fn().mockResolvedValue({ id: 'u-1', username: 'someone', password_hash: 'NEWHASH' }),
  deactivateUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/db/suppliers', () => ({
  getSuppliers: jest.fn().mockResolvedValue([]),
  createSupplier: jest.fn().mockResolvedValue({ id: 'sup-new', name: 'Acme Mills', status: 'onboarding' }),
}));

jest.mock('@/lib/db/audit-log', () => ({ appendAuditLog: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({
  loginLimiter: jest.fn().mockReturnValue(null),
  backupLimiter: jest.fn().mockReturnValue(null),
  ocrLimiter: jest.fn().mockReturnValue(null),
  downloadLimiter: jest.fn().mockReturnValue(null),
  adminLimiter: jest.fn().mockReturnValue(null),
}));

function req(url: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') {
  return new NextRequest(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
const admin = { 'x-user-id': 'a1', 'x-user-role': 'admin', 'x-user-name': 'hardik' };
const staff = { 'x-user-id': 's1', 'x-user-role': 'staff', 'x-user-name': 'staffy' };

const validUser = { username: 'newstaff', display_name: 'New Staff', email: 'new@rel.com', password: 'password123', role: 'staff' };

// ── POST /api/users ───────────────────────────────────────────────────────────
describe('POST /api/users — Add Staff User', () => {
  it('admin creates a staff user → 201, hashes via createUser, audits, no password_hash leaked', async () => {
    const { createUser } = require('@/lib/db/users');
    const { appendAuditLog } = require('@/lib/db/audit-log');
    createUser.mockClear();
    appendAuditLog.mockClear();

    const { POST } = require('@/app/api/users/route');
    const res = await POST(req('http://localhost/api/users', validUser, admin));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).not.toHaveProperty('password_hash');
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser.mock.calls[0][0]).toMatchObject({ username: 'newstaff', display_name: 'New Staff', role: 'staff' });
    expect(appendAuditLog.mock.calls[0][0].action_type).toBe('user.create');
  });

  it('staff role → 403 (admin only)', async () => {
    const { POST } = require('@/app/api/users/route');
    const res = await POST(req('http://localhost/api/users', validUser, staff));
    expect(res.status).toBe(403);
  });

  it('no auth → 401', async () => {
    const { POST } = require('@/app/api/users/route');
    const res = await POST(req('http://localhost/api/users', validUser));
    expect(res.status).toBe(401);
  });

  it('duplicate username → 409 with clear message', async () => {
    const { getUserByUsername } = require('@/lib/db/users');
    getUserByUsername.mockResolvedValueOnce({ id: 'u-existing', username: 'newstaff' });
    const { POST } = require('@/app/api/users/route');
    const res = await POST(req('http://localhost/api/users', validUser, admin));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/taken/i);
  });

  it('admin MAY create an admin (v1.2.0 hierarchy) → 201', async () => {
    const { POST } = require('@/app/api/users/route');
    const res = await POST(req('http://localhost/api/users', { ...validUser, role: 'admin' }, admin));
    expect(res.status).toBe(201);
  });

  it('invalid role value → 400 (rejected by schema enum)', async () => {
    const { POST } = require('@/app/api/users/route');
    const res = await POST(req('http://localhost/api/users', { ...validUser, role: 'superuser' }, admin));
    expect(res.status).toBe(400);
  });

  it('password shorter than 8 → 400', async () => {
    const { POST } = require('@/app/api/users/route');
    const res = await POST(req('http://localhost/api/users', { ...validUser, password: 'short' }, admin));
    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/users/[id] — password reset ────────────────────────────────────
describe('PATCH /api/users/[id] — admin password reset', () => {
  const params = { params: Promise.resolve({ id: 'u-1' }) };

  it('admin resets password → 200, updateUser({password}), audits user.password_reset', async () => {
    const { updateUser } = require('@/lib/db/users');
    const { appendAuditLog } = require('@/lib/db/audit-log');
    updateUser.mockClear();
    appendAuditLog.mockClear();

    const { PATCH } = require('@/app/api/users/[id]/route');
    const res = await PATCH(req('http://localhost/api/users/u-1', { action: 'reset_password', password: 'brandnewpw1' }, admin, 'PATCH'), params);
    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith('u-1', { password: 'brandnewpw1' });
    expect(appendAuditLog.mock.calls[0][0].action_type).toBe('user.password_reset');
  });

  it('staff → 403', async () => {
    const { PATCH } = require('@/app/api/users/[id]/route');
    const res = await PATCH(req('http://localhost/api/users/u-1', { action: 'reset_password', password: 'brandnewpw1' }, staff, 'PATCH'), params);
    expect(res.status).toBe(403);
  });

  it('short password → 400', async () => {
    const { PATCH } = require('@/app/api/users/[id]/route');
    const res = await PATCH(req('http://localhost/api/users/u-1', { action: 'reset_password', password: 'x' }, admin, 'PATCH'), params);
    expect(res.status).toBe(400);
  });
});

// ── POST /api/suppliers — Add Supplier ────────────────────────────────────────
describe('POST /api/suppliers — Add Supplier', () => {
  it('admin/staff create → 201, audits supplier.create', async () => {
    const { createSupplier } = require('@/lib/db/suppliers');
    const { appendAuditLog } = require('@/lib/db/audit-log');
    createSupplier.mockClear();
    appendAuditLog.mockClear();

    const { POST } = require('@/app/api/suppliers/route');
    const res = await POST(req('http://localhost/api/suppliers', { name: 'Acme Mills', tier: '1', city: 'Surat', contacts: [{ name: 'Jane', email: 'jane@acme.com' }] }, staff));
    expect(res.status).toBe(201);
    expect(createSupplier).toHaveBeenCalledTimes(1);
    expect(appendAuditLog.mock.calls[0][0].action_type).toBe('supplier.create');
  });

  it('no auth → 401', async () => {
    const { POST } = require('@/app/api/suppliers/route');
    const res = await POST(req('http://localhost/api/suppliers', { name: 'Acme' }));
    expect(res.status).toBe(401);
  });

  it('missing name → 400', async () => {
    const { POST } = require('@/app/api/suppliers/route');
    const res = await POST(req('http://localhost/api/suppliers', { tier: '1' }, admin));
    expect(res.status).toBe(400);
  });
});
