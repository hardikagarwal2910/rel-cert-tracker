/**
 * Instruction 5 — Task 7: CORS lockdown in middleware.
 * Only the configured app origin may receive a credentialed
 * Access-Control-Allow-Origin header.
 */

import { NextRequest } from 'next/server';

// getToken returns null (no session) — we only care about CORS headers here.
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn().mockResolvedValue(null),
}));

const APP_ORIGIN = 'https://app.example.com';

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = APP_ORIGIN;
  process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long!!';
});

function apiReq(origin: string | null, method = 'GET') {
  const headers: Record<string, string> = {};
  if (origin) headers['origin'] = origin;
  return new NextRequest('http://localhost/api/certificates', { method, headers });
}

describe('CORS middleware', () => {
  it('allowed origin receives matching Access-Control-Allow-Origin', async () => {
    const { middleware } = require('@/middleware');
    const res = await middleware(apiReq(APP_ORIGIN));
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('cross-origin request does NOT receive a matching allow-origin header', async () => {
    const { middleware } = require('@/middleware');
    const evil = 'https://evil.example.com';
    const res = await middleware(apiReq(evil));
    expect(res.headers.get('access-control-allow-origin')).not.toBe(evil);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('never returns a wildcard origin', async () => {
    const { middleware } = require('@/middleware');
    const res = await middleware(apiReq('https://evil.example.com'));
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
  });

  it('OPTIONS preflight from allowed origin → 204 with CORS headers', async () => {
    const { middleware } = require('@/middleware');
    const res = await middleware(apiReq(APP_ORIGIN, 'OPTIONS'));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('access-control-allow-methods')).toContain('PATCH');
  });

  it('OPTIONS preflight from disallowed origin → 204 without allow-origin', async () => {
    const { middleware } = require('@/middleware');
    const res = await middleware(apiReq('https://evil.example.com', 'OPTIONS'));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('public API route passes through (with CORS for allowed origin)', async () => {
    const { middleware } = require('@/middleware');
    const req = new NextRequest('http://localhost/api/auth/session', {
      headers: { origin: APP_ORIGIN },
    });
    const res = await middleware(req);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
  });

  it('unauthenticated supplier API route → 401', async () => {
    const { middleware } = require('@/middleware');
    const req = new NextRequest('http://localhost/api/supplier-certs', {
      headers: { origin: APP_ORIGIN },
    });
    const res = await middleware(req);
    expect(res.status).toBe(401);
  });

  it('unauthenticated dashboard page → redirect to /login', async () => {
    const { middleware } = require('@/middleware');
    const req = new NextRequest('http://localhost/dashboard');
    const res = await middleware(req);
    // NextResponse.redirect → 307/308
    expect([307, 308]).toContain(res.status);
  });

  it('request with no Origin header gets no allow-origin', async () => {
    const { middleware } = require('@/middleware');
    const res = await middleware(apiReq(null));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
