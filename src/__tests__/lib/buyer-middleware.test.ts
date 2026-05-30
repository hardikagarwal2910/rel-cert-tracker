/**
 * Middleware: buyer-portal protection + public buyer routes.
 */

import { NextRequest } from 'next/server';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn().mockResolvedValue(null),
}));

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-32chars-minimu!';
});

function req(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('middleware — buyer portal', () => {
  it('/buyer-portal/* without rel_buyer_token → redirect to /buyer/login', async () => {
    const { middleware } = require('@/middleware');
    const res = await middleware(req('/buyer-portal/certificates'));
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toContain('/buyer/login');
  });

  it('public /buyer/login is allowed (no redirect)', async () => {
    const { middleware } = require('@/middleware');
    const res = await middleware(req('/buyer/login'));
    expect(res.status).toBe(200);
  });

  it('public /buyer/register is allowed', async () => {
    const { middleware } = require('@/middleware');
    const res = await middleware(req('/buyer/register'));
    expect(res.status).toBe(200);
  });

  it('public /api/buyer-auth/register is allowed', async () => {
    const { middleware } = require('@/middleware');
    const res = await middleware(req('/api/buyer-auth/register'));
    expect(res.status).toBe(200);
  });
});
