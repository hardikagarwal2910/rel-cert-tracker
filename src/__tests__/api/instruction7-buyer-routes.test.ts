/**
 * Buyer-facing routes: registration, admin approval lifecycle, and login
 * (status gating + httpOnly cookie).
 */

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

jest.mock('@/lib/auth/middleware', () => ({
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
  verifyBuyerToken: jest.fn(),
}));

jest.mock('@/lib/db/buyers', () => ({
  registerBuyer: jest.fn().mockResolvedValue({ id: 'b1', name: 'Acme', email: 'buyer@acme.com', status: 'pending' }),
  approveBuyer: jest.fn().mockResolvedValue({ buyer: { id: 'b1', name: 'Acme', email: 'buyer@acme.com', status: 'approved' }, token: 'invite-token-xyz' }),
  rejectBuyer: jest.fn().mockResolvedValue({ id: 'b1', name: 'Acme', email: 'buyer@acme.com', status: 'rejected' }),
  suspendBuyer: jest.fn().mockResolvedValue({ id: 'b1', name: 'Acme', email: 'buyer@acme.com', status: 'suspended' }),
  getBuyerByEmail: jest.fn(),
  updateBuyerLogin: jest.fn().mockResolvedValue(undefined),
  logBuyerVisit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/mailer', () => ({
  sendBuyerRegistrationNotification: jest.fn().mockResolvedValue({ success: true }),
  sendBuyerApprovalEmail: jest.fn().mockResolvedValue({ success: true }),
  sendBuyerRejectionEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/db/audit-log', () => ({ appendAuditLog: jest.fn() }));

jest.mock('@/lib/rate-limit', () => ({
  loginLimiter: jest.fn().mockReturnValue(null),
  backupLimiter: jest.fn().mockReturnValue(null),
  ocrLimiter: jest.fn().mockReturnValue(null),
  downloadLimiter: jest.fn().mockReturnValue(null),
  adminLimiter: jest.fn().mockReturnValue(null),
}));

function jsonReq(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
function adminHeaders() {
  return { 'x-user-id': 'user-1', 'x-user-role': 'admin', 'x-user-name': 'hardik' };
}

// ── Registration ──────────────────────────────────────────────────────────────

describe('POST /api/buyer-auth/register', () => {
  beforeAll(() => { process.env.NOTIFICATION_EMAIL = 'rel@test.com'; });

  it('creates a pending buyer and notifies admin', async () => {
    const { registerBuyer } = require('@/lib/db/buyers');
    const { sendBuyerRegistrationNotification } = require('@/lib/mailer');
    registerBuyer.mockClear();
    sendBuyerRegistrationNotification.mockClear();

    const { POST } = require('@/app/api/buyer-auth/register/route');
    const res = await POST(jsonReq('http://localhost/api/buyer-auth/register',
      { name: 'Acme', company: 'Acme Co', email: 'buyer@acme.com', designation: 'Buyer' },
      { 'x-forwarded-for': '127.0.0.1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(registerBuyer).toHaveBeenCalled();
    expect(sendBuyerRegistrationNotification).toHaveBeenCalledTimes(1);
  });

  it('invalid email → 400', async () => {
    const { POST } = require('@/app/api/buyer-auth/register/route');
    const res = await POST(jsonReq('http://localhost/api/buyer-auth/register', { name: 'X', email: 'nope' }, { 'x-forwarded-for': '127.0.0.1' }));
    expect(res.status).toBe(400);
  });
});

// ── Approval lifecycle ────────────────────────────────────────────────────────

describe('Buyer admin actions', () => {
  it('approve → 200, emails set-password link, audits', async () => {
    const { approveBuyer } = require('@/lib/db/buyers');
    const { sendBuyerApprovalEmail } = require('@/lib/mailer');
    approveBuyer.mockClear();
    sendBuyerApprovalEmail.mockClear();

    const { POST } = require('@/app/api/buyers/[id]/approve/route');
    const res = await POST(jsonReq('http://localhost/api/buyers/b1/approve', {}, adminHeaders()), { params: Promise.resolve({ id: 'b1' }) });
    expect(res.status).toBe(200);
    expect(approveBuyer).toHaveBeenCalledWith('b1', 'user-1');
    expect(sendBuyerApprovalEmail).toHaveBeenCalledTimes(1);
    const arg = sendBuyerApprovalEmail.mock.calls[0][0];
    expect(arg.setPasswordUrl).toContain('token=invite-token-xyz');
  });

  it('approve without admin → 403', async () => {
    const { POST } = require('@/app/api/buyers/[id]/approve/route');
    const res = await POST(jsonReq('http://localhost/api/buyers/b1/approve', {}, { 'x-user-id': 'u', 'x-user-role': 'staff' }), { params: Promise.resolve({ id: 'b1' }) });
    expect(res.status).toBe(403);
  });

  it('reject → 200', async () => {
    const { POST } = require('@/app/api/buyers/[id]/reject/route');
    const res = await POST(jsonReq('http://localhost/api/buyers/b1/reject', {}, adminHeaders()), { params: Promise.resolve({ id: 'b1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('rejected');
  });

  it('suspend → 200', async () => {
    const { POST } = require('@/app/api/buyers/[id]/suspend/route');
    const res = await POST(jsonReq('http://localhost/api/buyers/b1/suspend', {}, adminHeaders()), { params: Promise.resolve({ id: 'b1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('suspended');
  });
});

// ── Buyer login ───────────────────────────────────────────────────────────────

describe('POST /api/buyer-auth/login', () => {
  const PW_HASH = bcrypt.hashSync('password123', 10);

  it('approved buyer → 200, httpOnly cookie, no token in body', async () => {
    const { getBuyerByEmail } = require('@/lib/db/buyers');
    getBuyerByEmail.mockResolvedValueOnce({ id: 'b1', name: 'Acme', email: 'buyer@acme.com', status: 'approved', password_hash: PW_HASH });

    const { POST } = require('@/app/api/buyer-auth/login/route');
    const res = await POST(jsonReq('http://localhost/api/buyer-auth/login', { email: 'buyer@acme.com', password: 'password123' }, { 'x-forwarded-for': '1.1.1.1' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).not.toHaveProperty('token');
    expect(body).toHaveProperty('buyer_id', 'b1');

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('rel_buyer_token');
    expect(setCookie?.toLowerCase()).toContain('httponly');
    expect(setCookie?.toLowerCase()).toContain('samesite=strict');
  });

  it('pending buyer → 403', async () => {
    const { getBuyerByEmail } = require('@/lib/db/buyers');
    getBuyerByEmail.mockResolvedValueOnce({ id: 'b2', name: 'P', email: 'p@x.com', status: 'pending', password_hash: PW_HASH });
    const { POST } = require('@/app/api/buyer-auth/login/route');
    const res = await POST(jsonReq('http://localhost/api/buyer-auth/login', { email: 'p@x.com', password: 'password123' }));
    expect(res.status).toBe(403);
  });

  it('suspended buyer → 403', async () => {
    const { getBuyerByEmail } = require('@/lib/db/buyers');
    getBuyerByEmail.mockResolvedValueOnce({ id: 'b3', name: 'S', email: 's@x.com', status: 'suspended', password_hash: PW_HASH });
    const { POST } = require('@/app/api/buyer-auth/login/route');
    const res = await POST(jsonReq('http://localhost/api/buyer-auth/login', { email: 's@x.com', password: 'password123' }));
    expect(res.status).toBe(403);
  });

  it('rejected buyer → 403', async () => {
    const { getBuyerByEmail } = require('@/lib/db/buyers');
    getBuyerByEmail.mockResolvedValueOnce({ id: 'b4', name: 'R', email: 'r@x.com', status: 'rejected', password_hash: PW_HASH });
    const { POST } = require('@/app/api/buyer-auth/login/route');
    const res = await POST(jsonReq('http://localhost/api/buyer-auth/login', { email: 'r@x.com', password: 'password123' }));
    expect(res.status).toBe(403);
  });

  it('wrong password (approved) → 401', async () => {
    const { getBuyerByEmail } = require('@/lib/db/buyers');
    getBuyerByEmail.mockResolvedValueOnce({ id: 'b1', name: 'Acme', email: 'buyer@acme.com', status: 'approved', password_hash: PW_HASH });
    const { POST } = require('@/app/api/buyer-auth/login/route');
    const res = await POST(jsonReq('http://localhost/api/buyer-auth/login', { email: 'buyer@acme.com', password: 'WRONG' }));
    expect(res.status).toBe(401);
  });

  it('unknown buyer → 401', async () => {
    const { getBuyerByEmail } = require('@/lib/db/buyers');
    getBuyerByEmail.mockResolvedValueOnce(null);
    const { POST } = require('@/app/api/buyer-auth/login/route');
    const res = await POST(jsonReq('http://localhost/api/buyer-auth/login', { email: 'ghost@x.com', password: 'password123' }));
    expect(res.status).toBe(401);
  });
});
