/**
 * v1.1.1 soft-delete / archive — API routes.
 *
 * Covers the PATCH archive/restore actions (certificates, suppliers,
 * locations), category deactivate, role enforcement, audit logging, and the
 * confirmation that a suspended buyer is blocked at login (403).
 */

import { NextRequest } from 'next/server';

// ── Auth middleware (role from x-user-role header) ────────────────────────────
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
  isAuthResult: jest.fn((r: unknown) => !(r && typeof r === 'object' && 'headers' in r)),
  requireSupplierAuth: jest.fn(),
  verifySupplierToken: jest.fn(),
}));

jest.mock('@/lib/db/certificates', () => ({
  getCertificateById: jest.fn().mockResolvedValue({ id: 'cert-001', name: 'ISO 9001', archived: false }),
  updateCertificate: jest.fn(),
  deleteCertificate: jest.fn(),
  archiveCertificate: jest.fn().mockResolvedValue({ id: 'cert-001', name: 'ISO 9001', archived: true, buyer_visible: false }),
  unarchiveCertificate: jest.fn().mockResolvedValue({ id: 'cert-001', name: 'ISO 9001', archived: false }),
}));

jest.mock('@/lib/db/suppliers', () => ({
  getSupplierById: jest.fn().mockResolvedValue({ id: 'sup-001', name: 'Acme Mills', status: 'active' }),
  updateSupplier: jest.fn(),
  getSupplierScorecard: jest.fn().mockResolvedValue({}),
  archiveSupplier: jest.fn().mockResolvedValue({ id: 'sup-001', name: 'Acme Mills', status: 'inactive' }),
  reactivateSupplier: jest.fn().mockResolvedValue({ id: 'sup-001', name: 'Acme Mills', status: 'active' }),
}));

jest.mock('@/lib/db/locations', () => ({
  updateLocation: jest.fn(),
  deactivateLocation: jest.fn().mockResolvedValue(undefined),
  reactivateLocation: jest.fn().mockResolvedValue(undefined),
  getLocationById: jest.fn().mockResolvedValue({ id: 'loc-001', name: 'Shilaj Unit', active: true }),
  getCertCountByLocation: jest.fn().mockResolvedValue([{ location_id: 'loc-001', count: 3 }]),
}));

jest.mock('@/lib/db/categories', () => ({
  getCategories: jest.fn().mockResolvedValue([]),
  createCategory: jest.fn(),
  deactivateCategory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/db/buyers', () => ({
  getBuyerByEmail: jest.fn(),
  updateBuyerLogin: jest.fn().mockResolvedValue(undefined),
  logBuyerVisit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/db/audit-log', () => ({ appendAuditLog: jest.fn() }));

jest.mock('@/lib/rate-limit', () => ({
  loginLimiter: jest.fn().mockReturnValue(null),
  backupLimiter: jest.fn().mockReturnValue(null),
  ocrLimiter: jest.fn().mockReturnValue(null),
  downloadLimiter: jest.fn().mockReturnValue(null),
  adminLimiter: jest.fn().mockReturnValue(null),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function req(url: string, body: unknown, headers: Record<string, string> = {}, method = 'PATCH') {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
const admin = { 'x-user-id': 'u1', 'x-user-role': 'admin', 'x-user-name': 'hardik' };
const staff = { 'x-user-id': 'u2', 'x-user-role': 'staff', 'x-user-name': 'staffy' };

// ── Certificate archive / restore (PATCH) ─────────────────────────────────────
describe('PATCH /api/certificates/[id]', () => {
  const params = { params: Promise.resolve({ id: 'cert-001' }) };

  it('no auth → 401', async () => {
    const { PATCH } = require('@/app/api/certificates/[id]/route');
    const res = await PATCH(req('http://localhost/api/certificates/cert-001', { action: 'archive' }), params);
    expect(res.status).toBe(401);
  });

  it('staff can archive (reversible action) → 200, archives + audits', async () => {
    const { archiveCertificate } = require('@/lib/db/certificates');
    const { appendAuditLog } = require('@/lib/db/audit-log');
    archiveCertificate.mockClear();
    appendAuditLog.mockClear();

    const { PATCH } = require('@/app/api/certificates/[id]/route');
    const res = await PATCH(req('http://localhost/api/certificates/cert-001', { action: 'archive' }, staff), params);
    expect(res.status).toBe(200);
    expect(archiveCertificate).toHaveBeenCalledWith('cert-001', 'u2');
    expect(appendAuditLog).toHaveBeenCalledTimes(1);
    expect(appendAuditLog.mock.calls[0][0].action_type).toBe('certificate.archive');
  });

  it('action=unarchive → 200 and calls unarchiveCertificate', async () => {
    const { unarchiveCertificate } = require('@/lib/db/certificates');
    unarchiveCertificate.mockClear();
    const { PATCH } = require('@/app/api/certificates/[id]/route');
    const res = await PATCH(req('http://localhost/api/certificates/cert-001', { action: 'unarchive' }, admin), params);
    expect(res.status).toBe(200);
    expect(unarchiveCertificate).toHaveBeenCalledWith('cert-001');
  });

  it('invalid action → 400', async () => {
    const { PATCH } = require('@/app/api/certificates/[id]/route');
    const res = await PATCH(req('http://localhost/api/certificates/cert-001', { action: 'nuke' }, admin), params);
    expect(res.status).toBe(400);
  });

  it('cert not found → 404', async () => {
    const { getCertificateById } = require('@/lib/db/certificates');
    getCertificateById.mockResolvedValueOnce(null);
    const { PATCH } = require('@/app/api/certificates/[id]/route');
    const res = await PATCH(req('http://localhost/api/certificates/missing', { action: 'archive' }, admin), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });
});

// ── Supplier archive / reactivate (PATCH) ─────────────────────────────────────
describe('PATCH /api/suppliers/[id]', () => {
  const params = { params: Promise.resolve({ id: 'sup-001' }) };

  it('staff → 403 (supplier archive is admin-only)', async () => {
    const { PATCH } = require('@/app/api/suppliers/[id]/route');
    const res = await PATCH(req('http://localhost/api/suppliers/sup-001', { action: 'archive' }, staff), params);
    expect(res.status).toBe(403);
  });

  it('admin archive → 200, status inactive, audits supplier.archive', async () => {
    const { archiveSupplier } = require('@/lib/db/suppliers');
    const { appendAuditLog } = require('@/lib/db/audit-log');
    archiveSupplier.mockClear();
    appendAuditLog.mockClear();

    const { PATCH } = require('@/app/api/suppliers/[id]/route');
    const res = await PATCH(req('http://localhost/api/suppliers/sup-001', { action: 'archive' }, admin), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('inactive');
    expect(archiveSupplier).toHaveBeenCalledWith('sup-001');
    expect(appendAuditLog.mock.calls[0][0].action_type).toBe('supplier.archive');
  });

  it('admin reactivate → 200, audits supplier.reactivate', async () => {
    const { appendAuditLog } = require('@/lib/db/audit-log');
    appendAuditLog.mockClear();
    const { PATCH } = require('@/app/api/suppliers/[id]/route');
    const res = await PATCH(req('http://localhost/api/suppliers/sup-001', { action: 'reactivate' }, admin), params);
    expect(res.status).toBe(200);
    expect(appendAuditLog.mock.calls[0][0].action_type).toBe('supplier.reactivate');
  });
});

// ── Location deactivate / reactivate (PATCH) ──────────────────────────────────
describe('PATCH /api/locations/[id]', () => {
  const params = { params: Promise.resolve({ id: 'loc-001' }) };

  it('staff → 403 (admin only)', async () => {
    const { PATCH } = require('@/app/api/locations/[id]/route');
    const res = await PATCH(req('http://localhost/api/locations/loc-001', { action: 'deactivate' }, staff), params);
    expect(res.status).toBe(403);
  });

  it('admin deactivate (location in use) → 200 with cert-count note, does not delete', async () => {
    const { deactivateLocation } = require('@/lib/db/locations');
    const { appendAuditLog } = require('@/lib/db/audit-log');
    deactivateLocation.mockClear();
    appendAuditLog.mockClear();

    const { PATCH } = require('@/app/api/locations/[id]/route');
    const res = await PATCH(req('http://localhost/api/locations/loc-001', { action: 'deactivate' }, admin), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(false);
    expect(body.message).toMatch(/certificate/i);
    expect(deactivateLocation).toHaveBeenCalledWith('loc-001');
    expect(appendAuditLog.mock.calls[0][0].action_type).toBe('location.deactivate');
  });

  it('admin reactivate → 200, audits location.reactivate', async () => {
    const { reactivateLocation } = require('@/lib/db/locations');
    const { appendAuditLog } = require('@/lib/db/audit-log');
    reactivateLocation.mockClear();
    appendAuditLog.mockClear();
    const { PATCH } = require('@/app/api/locations/[id]/route');
    const res = await PATCH(req('http://localhost/api/locations/loc-001', { action: 'reactivate' }, admin), params);
    expect(res.status).toBe(200);
    expect(reactivateLocation).toHaveBeenCalledWith('loc-001');
    expect(appendAuditLog.mock.calls[0][0].action_type).toBe('location.reactivate');
  });
});

// ── Category deactivate (PUT) ─────────────────────────────────────────────────
describe('PUT /api/categories — deactivate', () => {
  it('staff → 403 (admin only)', async () => {
    const { PUT } = require('@/app/api/categories/route');
    const res = await PUT(req('http://localhost/api/categories', { id: 'cat-1' }, staff, 'PUT'));
    expect(res.status).toBe(403);
  });

  it('admin → 200, calls deactivateCategory + audits', async () => {
    const { deactivateCategory } = require('@/lib/db/categories');
    const { appendAuditLog } = require('@/lib/db/audit-log');
    deactivateCategory.mockClear();
    appendAuditLog.mockClear();

    const { PUT } = require('@/app/api/categories/route');
    const res = await PUT(req('http://localhost/api/categories', { id: 'cat-1' }, admin, 'PUT'));
    expect(res.status).toBe(200);
    expect(deactivateCategory).toHaveBeenCalledWith('cat-1');
    expect(appendAuditLog.mock.calls[0][0].action_type).toBe('category.deactivate');
  });
});

// ── Suspended buyer is blocked at login ───────────────────────────────────────
describe('POST /api/buyer-auth/login — suspended buyer blocked', () => {
  const bcrypt = require('bcryptjs');
  const PW_HASH = bcrypt.hashSync('password123', 10);

  it('suspended buyer with a valid password → 403 (cannot log in)', async () => {
    const { getBuyerByEmail } = require('@/lib/db/buyers');
    getBuyerByEmail.mockResolvedValueOnce({
      id: 'b1', name: 'Suspended Co', email: 's@x.com', status: 'suspended', password_hash: PW_HASH,
    });
    const { POST } = require('@/app/api/buyer-auth/login/route');
    const res = await POST(req('http://localhost/api/buyer-auth/login', { email: 's@x.com', password: 'password123' }, {}, 'POST'));
    expect(res.status).toBe(403);
  });
});
