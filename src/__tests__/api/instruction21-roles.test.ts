/**
 * v1.2.0 — four-tier role gating at the ROUTE layer. The mocked requireCap uses
 * the REAL permission matrix, so these assert the actual allow/deny behaviour.
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/middleware', () => {
  const { NextResponse } = require('next/server');
  const real = jest.requireActual('@/lib/auth/permissions');
  const authFrom = (req: { headers: { get: (k: string) => string | null } }) => {
    const id = req.headers.get('x-user-id');
    const role = req.headers.get('x-user-role');
    const username = req.headers.get('x-user-name') ?? 'tester';
    return { id, role, username, email: `${username}@test.com` };
  };
  return {
    requireCap: jest.fn(async (req: any, cap: string) => {
      const { id, role, username, email } = authFrom(req);
      if (!id || !role) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      if (!real.can(role, cap)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      return { id, role, username, email };
    }),
    requireAuth: jest.fn(async (req: any, roles: string[] = ['admin', 'staff']) => {
      const { id, role, username, email } = authFrom(req);
      if (!id || !role) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      if (!roles.includes(role)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      return { id, role, username, email };
    }),
    requireSupplierAuth: jest.fn(),
    isAuthResult: jest.fn((r: unknown) => !(r && typeof r === 'object' && 'headers' in r)),
    verifySupplierToken: jest.fn(),
  };
});

jest.mock('@/lib/db/certificates', () => ({
  getCertificates: jest.fn().mockResolvedValue([]),
  getCertificateById: jest.fn().mockResolvedValue({ id: 'c1', name: 'ISO 9001', version_history: [] }),
  createCertificate: jest.fn().mockResolvedValue({ id: 'c-new', name: 'ISO 9001' }),
  updateCertificate: jest.fn().mockResolvedValue({ id: 'c1', name: 'ISO 9001' }),
  deleteCertificate: jest.fn().mockResolvedValue(undefined),
  archiveCertificate: jest.fn().mockResolvedValue({ id: 'c1', name: 'ISO 9001' }),
  unarchiveCertificate: jest.fn().mockResolvedValue({ id: 'c1', name: 'ISO 9001' }),
}));
jest.mock('@/lib/db/categories', () => ({
  getCategories: jest.fn().mockResolvedValue([]),
  createCategory: jest.fn().mockResolvedValue({ id: 'cat1', name: 'Quality' }),
  deactivateCategory: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/db/audit-log', () => ({
  appendAuditLog: jest.fn(),
  getAuditLog: jest.fn().mockResolvedValue([]),
  getDistinctActionTypes: jest.fn().mockResolvedValue([]),
  exportAuditLogCsv: jest.fn().mockResolvedValue(''),
}));
jest.mock('@/lib/db/users', () => ({
  getUsers: jest.fn().mockResolvedValue([]),
  getUserByUsername: jest.fn().mockResolvedValue(null),
  getUserById: jest.fn(),
  createUser: jest.fn().mockResolvedValue({ id: 'u-new', username: 'newbie', role: 'staff', password_hash: 'H' }),
  updateUser: jest.fn().mockResolvedValue({ id: 'u1', username: 'someone', password_hash: 'H' }),
  deactivateUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/rate-limit', () => ({
  loginLimiter: jest.fn().mockReturnValue(null), backupLimiter: jest.fn().mockReturnValue(null),
  ocrLimiter: jest.fn().mockReturnValue(null), downloadLimiter: jest.fn().mockReturnValue(null),
  adminLimiter: jest.fn().mockReturnValue(null),
}));

function req(url: string, body: unknown, role: string | null, method = 'POST', id = 'u-actor') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (role) { headers['x-user-role'] = role; headers['x-user-id'] = id; headers['x-user-name'] = role; }
  return new NextRequest(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const P = (id: string) => ({ params: Promise.resolve({ id }) });

// ── Create certificate (ADD_ENTITY: admin/manager/staff) ──────────────────────
describe('POST /api/certificates — ADD_ENTITY', () => {
  const body = { name: 'ISO 14001', expiry_date: '2027-01-01' };
  it.each([['admin', 201], ['manager', 201], ['staff', 201], ['viewer', 403]])('%s → %i', async (role, code) => {
    const { POST } = require('@/app/api/certificates/route');
    const res = await POST(req('http://localhost/api/certificates', body, role));
    expect(res.status).toBe(code);
  });
  it('no auth → 401', async () => {
    const { POST } = require('@/app/api/certificates/route');
    expect((await POST(req('http://localhost/api/certificates', body, null))).status).toBe(401);
  });
});

// ── View (VIEW_DATA: viewer allowed) ──────────────────────────────────────────
describe('GET /api/certificates — VIEW_DATA includes viewer', () => {
  it('viewer → 200', async () => {
    const { GET } = require('@/app/api/certificates/route');
    expect((await GET(req('http://localhost/api/certificates', undefined, 'viewer', 'GET'))).status).toBe(200);
  });
});

// ── Edit / archive / hard-delete cert ─────────────────────────────────────────
describe('certificate mutations by role', () => {
  it('PUT (EDIT_ENTITY): manager 200, staff 403, viewer 403', async () => {
    const { PUT } = require('@/app/api/certificates/[id]/route');
    expect((await PUT(req('http://localhost/api/certificates/c1', { name: 'X' }, 'manager', 'PUT'), P('c1'))).status).toBe(200);
    expect((await PUT(req('http://localhost/api/certificates/c1', { name: 'X' }, 'staff', 'PUT'), P('c1'))).status).toBe(403);
    expect((await PUT(req('http://localhost/api/certificates/c1', { name: 'X' }, 'viewer', 'PUT'), P('c1'))).status).toBe(403);
  });
  it('PATCH (ARCHIVE): staff 403, manager 200', async () => {
    const { PATCH } = require('@/app/api/certificates/[id]/route');
    expect((await PATCH(req('http://localhost/api/certificates/c1', { action: 'archive' }, 'staff', 'PATCH'), P('c1'))).status).toBe(403);
    expect((await PATCH(req('http://localhost/api/certificates/c1', { action: 'archive' }, 'manager', 'PATCH'), P('c1'))).status).toBe(200);
  });
  it('DELETE (HARD_DELETE): manager 403, admin 200', async () => {
    const { DELETE } = require('@/app/api/certificates/[id]/route');
    expect((await DELETE(req('http://localhost/api/certificates/c1', undefined, 'manager', 'DELETE'), P('c1'))).status).toBe(403);
    expect((await DELETE(req('http://localhost/api/certificates/c1', undefined, 'admin', 'DELETE'), P('c1'))).status).toBe(200);
  });
});

// ── Audit log = admin only ────────────────────────────────────────────────────
describe('GET /api/audit-log — VIEW_AUDIT_LOG = admin only', () => {
  it.each([['admin', 200], ['manager', 403], ['staff', 403], ['viewer', 403]])('%s → %i', async (role, code) => {
    const { GET } = require('@/app/api/audit-log/route');
    expect((await GET(req('http://localhost/api/audit-log', undefined, role, 'GET'))).status).toBe(code);
  });
});

// ── Settings (category mgmt) = admin only ─────────────────────────────────────
describe('POST /api/categories — SETTINGS = admin only', () => {
  it.each([['admin', 201], ['manager', 403], ['staff', 403], ['viewer', 403]])('%s → %i', async (role, code) => {
    const { POST } = require('@/app/api/categories/route');
    expect((await POST(req('http://localhost/api/categories', { name: 'Quality' }, role))).status).toBe(code);
  });
});

// ── USER CREATION HIERARCHY (the critical guard) ──────────────────────────────
describe('POST /api/users — role-hierarchy guard', () => {
  const base = { username: 'newbie', password: 'password123' };
  it('manager creating admin → 403', async () => {
    const { POST } = require('@/app/api/users/route');
    expect((await POST(req('http://localhost/api/users', { ...base, role: 'admin' }, 'manager'))).status).toBe(403);
  });
  it('manager creating manager → 403', async () => {
    const { POST } = require('@/app/api/users/route');
    expect((await POST(req('http://localhost/api/users', { ...base, role: 'manager' }, 'manager'))).status).toBe(403);
  });
  it('manager creating staff → 201', async () => {
    const { POST } = require('@/app/api/users/route');
    expect((await POST(req('http://localhost/api/users', { ...base, role: 'staff' }, 'manager'))).status).toBe(201);
  });
  it('manager creating viewer → 201', async () => {
    const { POST } = require('@/app/api/users/route');
    expect((await POST(req('http://localhost/api/users', { ...base, role: 'viewer' }, 'manager'))).status).toBe(201);
  });
  it('admin creating manager → 201', async () => {
    const { POST } = require('@/app/api/users/route');
    expect((await POST(req('http://localhost/api/users', { ...base, role: 'manager' }, 'admin'))).status).toBe(201);
  });
  it('staff creating staff → 403 (no CREATE_USER)', async () => {
    const { POST } = require('@/app/api/users/route');
    expect((await POST(req('http://localhost/api/users', { ...base, role: 'staff' }, 'staff'))).status).toBe(403);
  });
});

// ── No self role-change; manager cannot manage an admin ───────────────────────
describe('PUT /api/users/[id] — self role-change + target guard', () => {
  it('user changing OWN role → 403', async () => {
    const { getUserById } = require('@/lib/db/users');
    getUserById.mockResolvedValueOnce({ id: 'u-self', username: 'me', role: 'admin' });
    const { PUT } = require('@/app/api/users/[id]/route');
    const res = await PUT(req('http://localhost/api/users/u-self', { role: 'manager' }, 'admin', 'PUT', 'u-self'), P('u-self'));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/own role/i);
  });
  it('manager managing an admin account → 403', async () => {
    const { getUserById } = require('@/lib/db/users');
    getUserById.mockResolvedValueOnce({ id: 'u-admin', username: 'boss', role: 'admin' });
    const { PUT } = require('@/app/api/users/[id]/route');
    const res = await PUT(req('http://localhost/api/users/u-admin', { display_name: 'x' }, 'manager', 'PUT', 'u-mgr'), P('u-admin'));
    expect(res.status).toBe(403);
  });
  it('admin updates a staff user → 200', async () => {
    const { getUserById } = require('@/lib/db/users');
    getUserById.mockResolvedValueOnce({ id: 'u-staff', username: 'joe', role: 'staff' });
    const { PUT } = require('@/app/api/users/[id]/route');
    const res = await PUT(req('http://localhost/api/users/u-staff', { display_name: 'Joe' }, 'admin', 'PUT', 'u-admin'), P('u-staff'));
    expect(res.status).toBe(200);
  });
});
