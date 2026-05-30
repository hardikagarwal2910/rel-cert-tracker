/**
 * OTP login routes: /api/auth/otp/request and /api/auth/otp/verify.
 * Covers the non-2FA regression path and the 2FA challenge path.
 */

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

const PW_HASH = bcrypt.hashSync('password123', 10);

const userNo2FA = {
  id: 'user-1',
  username: 'hardik',
  password_hash: PW_HASH,
  email: 'hardik@test.com',
  role: 'admin',
  active: true,
  two_factor_enabled: false,
};
const user2FA = { ...userNo2FA, id: 'user-2', username: 'secure', two_factor_enabled: true };

jest.mock('@/lib/db/users', () => ({
  getUserByUsername: jest.fn(async (u: string) => {
    if (u === 'hardik') return userNo2FA;
    if (u === 'secure') return user2FA;
    return null;
  }),
}));

jest.mock('@/lib/db/otp', () => ({
  createOtp: jest.fn().mockResolvedValue('123456'),
  verifyOtp: jest.fn(),
}));

jest.mock('@/lib/mailer', () => ({
  sendOtp: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/db/audit-log', () => ({ appendAuditLog: jest.fn() }));

jest.mock('@/lib/rate-limit', () => ({
  loginLimiter: jest.fn().mockReturnValue(null),
  backupLimiter: jest.fn().mockReturnValue(null),
  ocrLimiter: jest.fn().mockReturnValue(null),
  downloadLimiter: jest.fn().mockReturnValue(null),
  adminLimiter: jest.fn().mockReturnValue(null),
}));

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/otp/request', () => {
  it('non-2FA user + correct password → twoFactorRequired:false (no regression)', async () => {
    const { POST } = require('@/app/api/auth/otp/request/route');
    const res = await POST(jsonReq('http://localhost/api/auth/otp/request', { username: 'hardik', password: 'password123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.twoFactorRequired).toBe(false);
  });

  it('2FA user + correct password → twoFactorRequired:true and emails a code', async () => {
    const { createOtp } = require('@/lib/db/otp');
    const { sendOtp } = require('@/lib/mailer');
    createOtp.mockClear();
    sendOtp.mockClear();

    const { POST } = require('@/app/api/auth/otp/request/route');
    const res = await POST(jsonReq('http://localhost/api/auth/otp/request', { username: 'secure', password: 'password123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.twoFactorRequired).toBe(true);
    expect(body.userId).toBe('user-2');
    expect(createOtp).toHaveBeenCalledWith('user-2');
    expect(sendOtp).toHaveBeenCalledTimes(1);
    // The plain code must never be in the response body
    expect(JSON.stringify(body)).not.toContain('123456');
  });

  it('wrong password → 401', async () => {
    const { POST } = require('@/app/api/auth/otp/request/route');
    const res = await POST(jsonReq('http://localhost/api/auth/otp/request', { username: 'hardik', password: 'WRONG' }));
    expect(res.status).toBe(401);
  });

  it('unknown user → 401', async () => {
    const { POST } = require('@/app/api/auth/otp/request/route');
    const res = await POST(jsonReq('http://localhost/api/auth/otp/request', { username: 'ghost', password: 'password123' }));
    expect(res.status).toBe(401);
  });

  it('missing fields → 400', async () => {
    const { POST } = require('@/app/api/auth/otp/request/route');
    const res = await POST(jsonReq('http://localhost/api/auth/otp/request', { username: 'hardik' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/otp/verify', () => {
  it('correct code → 200 with a token', async () => {
    const { verifyOtp } = require('@/lib/db/otp');
    verifyOtp.mockResolvedValueOnce({ ok: true });

    const { POST } = require('@/app/api/auth/otp/verify/route');
    const res = await POST(jsonReq('http://localhost/api/auth/otp/verify', { userId: 'user-2', code: '123456' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(10);
  });

  it('wrong code → 401 with remaining attempts', async () => {
    const { verifyOtp } = require('@/lib/db/otp');
    verifyOtp.mockResolvedValueOnce({ ok: false, remaining: 3 });

    const { POST } = require('@/app/api/auth/otp/verify/route');
    const res = await POST(jsonReq('http://localhost/api/auth/otp/verify', { userId: 'user-2', code: '000000' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.remaining).toBe(3);
  });

  it('missing fields → 400', async () => {
    const { POST } = require('@/app/api/auth/otp/verify/route');
    const res = await POST(jsonReq('http://localhost/api/auth/otp/verify', { userId: 'user-2' }));
    expect(res.status).toBe(400);
  });
});
