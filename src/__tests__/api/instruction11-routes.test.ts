/**
 * v1.1.0 — /api/auth/me, renewal_stage PUT, logout cookie clearing.
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/middleware', () => ({
  requireCap: jest.fn(async (req, cap) => { const role = req.headers.get("x-user-role"); const id = req.headers.get("x-user-id"); const username = req.headers.get("x-user-name") ?? "testuser"; const { NextResponse } = require("next/server"); if (!id || !role) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); const { can } = jest.requireActual("@/lib/auth/permissions"); if (!can(role, cap)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }); return { id, role, username, email: username + "@test.com" }; }),
  
  requireAuth: jest.fn(async (req: { headers: { get: (k: string) => string | null } }, roles: string[] = ['admin', 'staff']) => {
    const id = req.headers.get('x-user-id');
    const role = req.headers.get('x-user-role');
    if (!id || !role) { const { NextResponse } = require('next/server'); return NextResponse.json({ error: 'Authentication required' }, { status: 401 }); }
    if (!roles.includes(role)) { const { NextResponse } = require('next/server'); return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }); }
    return { id, role, username: req.headers.get('x-user-name') ?? 'hardik', email: 'h@test.com' };
  }),
  isAuthResult: jest.fn((r: unknown) => !(r && typeof r === 'object' && 'headers' in r)),
}));

jest.mock('@/lib/db/certificates', () => ({
  getCertificateById: jest.fn().mockResolvedValue({ id: 'c1', name: 'ISO 9001' }),
  updateCertificate: jest.fn().mockResolvedValue({ id: 'c1', name: 'ISO 9001', renewal_stage: 'in_progress' }),
  deleteCertificate: jest.fn(),
}));
jest.mock('@/lib/db/audit-log', () => ({ appendAuditLog: jest.fn() }));

function reqWith(url: string, headers: Record<string, string>, init: RequestInit = {}) {
  return new NextRequest(url, { ...init, headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) } });
}
const adminH = { 'x-user-id': 'user-1', 'x-user-role': 'admin', 'x-user-name': 'hardik' };

// ── /api/auth/me ──────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns the user when the session headers are present', async () => {
    const { GET } = require('@/app/api/auth/me/route');
    const res = await GET(reqWith('http://localhost/api/auth/me', { ...adminH, 'x-user-email': 'hardik@test.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('user-1');
    expect(body.role).toBe('admin');
    expect(body.username).toBe('hardik');
    // Never leak a token or password hash
    expect('token' in body).toBe(false);
    expect('password_hash' in body).toBe(false);
  });

  it('returns 401 when not authenticated', async () => {
    const { GET } = require('@/app/api/auth/me/route');
    const res = await GET(new NextRequest('http://localhost/api/auth/me'));
    expect(res.status).toBe(401);
  });
});

// ── renewal_stage via PUT ─────────────────────────────────────────────────────
describe('PUT /api/certificates/[id] — renewal_stage', () => {
  it('accepts renewal_stage, returns updated cert, audits certificate.renewal_stage', async () => {
    const { appendAuditLog } = require('@/lib/db/audit-log');
    appendAuditLog.mockClear();
    const { PUT } = require('@/app/api/certificates/[id]/route');
    const req = reqWith('http://localhost/api/certificates/c1', adminH, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renewal_stage: 'in_progress' }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.renewal_stage).toBe('in_progress');
    expect(appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action_type: 'certificate.renewal_stage' }));
  });

  it('rejects an invalid renewal_stage → 400', async () => {
    const { PUT } = require('@/app/api/certificates/[id]/route');
    const req = reqWith('http://localhost/api/certificates/c1', adminH, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renewal_stage: 'bogus' }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(400);
  });
});

// ── logout cookie clearing ────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('clears the authjs + supplier + buyer cookies', async () => {
    const { cookies } = require('next/headers');
    const store = await cookies();
    store.delete.mockClear();

    const { POST } = require('@/app/api/auth/logout/route');
    const res = await POST(new NextRequest('http://localhost/api/auth/logout', { method: 'POST' }));
    expect(res.status).toBe(200);

    const deleted = store.delete.mock.calls.map((c: unknown[]) => c[0]);
    expect(deleted).toContain('authjs.session-token');
    expect(deleted).toContain('__Secure-authjs.session-token');
    expect(deleted).toContain('rel_supplier_token');
    expect(deleted).toContain('rel_buyer_token');
  });
});
