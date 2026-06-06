/**
 * v1.1.0 — Action Queue data function + weekly digest cron.
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/db/certificates', () => ({
  getCertificates: jest.fn(),
  getExpiringSoon: jest.fn(),
}));
jest.mock('@/lib/db/supplier-certs', () => ({ getPendingReviewQueue: jest.fn() }));
jest.mock('@/lib/db/buyers', () => ({ getBuyers: jest.fn() }));
jest.mock('@/lib/db/pdf-requests', () => ({ getPdfRequests: jest.fn() }));
jest.mock('@/lib/db/notification-log', () => ({ logNotification: jest.fn() }));
jest.mock('@/lib/db/audit-log', () => ({ appendAuditLog: jest.fn() }));
jest.mock('@/lib/mailer', () => ({ sendWeeklyDigest: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('@/lib/auth/middleware', () => ({
  requireCap: jest.fn(async (req, cap) => { const role = req.headers.get("x-user-role"); const id = req.headers.get("x-user-id"); const username = req.headers.get("x-user-name") ?? "testuser"; const { NextResponse } = require("next/server"); if (!id || !role) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); const { can } = jest.requireActual("@/lib/auth/permissions"); if (!can(role, cap)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }); return { id, role, username, email: username + "@test.com" }; }),
  
  requireAuth: jest.fn(async (req: { headers: { get: (k: string) => string | null } }) => {
    const id = req.headers.get('x-user-id');
    if (!id) { const { NextResponse } = require('next/server'); return NextResponse.json({ error: 'Authentication required' }, { status: 401 }); }
    return { id, role: 'admin', username: 'hardik', email: 'h@test.com' };
  }),
  isAuthResult: jest.fn((r: unknown) => !(r && typeof r === 'object' && 'headers' in r)),
}));

const { getCertificates, getExpiringSoon } = require('@/lib/db/certificates');
const { getPendingReviewQueue } = require('@/lib/db/supplier-certs');
const { getBuyers } = require('@/lib/db/buyers');
const { getPdfRequests } = require('@/lib/db/pdf-requests');

const today = new Date();
const inDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };

describe('getActionQueue', () => {
  it('groups overdue, expiring-not-started, and pending counts', async () => {
    getCertificates.mockResolvedValue([
      { id: 'a', name: 'Overdue', expiry_date: inDays(-5), renewal_stage: 'not_started' },
      { id: 'b', name: 'SoonNotStarted', expiry_date: inDays(10), renewal_stage: 'not_started' },
      { id: 'c', name: 'SoonInProgress', expiry_date: inDays(10), renewal_stage: 'in_progress' },
      { id: 'd', name: 'Future', expiry_date: inDays(200), renewal_stage: 'not_started' },
    ]);
    getPendingReviewQueue.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    getBuyers.mockResolvedValue([{ id: 'b1' }]);
    getPdfRequests.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);

    const { getActionQueue } = require('@/lib/db/action-queue');
    const q = await getActionQueue();
    expect(q.overdue.map((i: { id: string }) => i.id)).toEqual(['a']);
    expect(q.expiringNotStarted.map((i: { id: string }) => i.id)).toEqual(['b']); // c is in_progress, d too far
    expect(q.supplierReviewCount).toBe(2);
    expect(q.pendingBuyerCount).toBe(1);
    expect(q.pdfRequestCount).toBe(3);
    expect(q.total).toBe(1 + 1 + 2 + 1 + 3);
  });

  it('returns total 0 when nothing needs attention', async () => {
    getCertificates.mockResolvedValue([]);
    getPendingReviewQueue.mockResolvedValue([]);
    getBuyers.mockResolvedValue([]);
    getPdfRequests.mockResolvedValue([]);
    const { getActionQueue } = require('@/lib/db/action-queue');
    const q = await getActionQueue();
    expect(q.total).toBe(0);
  });
});

describe('GET /api/cron/digest', () => {
  beforeAll(() => { process.env.CRON_SECRET = 'digest-secret'; process.env.NOTIFICATION_EMAIL = 'rel@test.com'; });
  beforeEach(() => {
    getExpiringSoon.mockResolvedValue([]);
    getCertificates.mockResolvedValue([]);
    getPendingReviewQueue.mockResolvedValue([]);
    getBuyers.mockResolvedValue([]);
  });

  it('without secret → 401', async () => {
    const { GET } = require('@/app/api/cron/digest/route');
    const res = await GET(new NextRequest('http://localhost/api/cron/digest'));
    expect(res.status).toBe(401);
  });

  it('with correct secret → 200 and sends the digest', async () => {
    const { sendWeeklyDigest } = require('@/lib/mailer');
    sendWeeklyDigest.mockClear();
    const { GET } = require('@/app/api/cron/digest/route');
    const res = await GET(new NextRequest('http://localhost/api/cron/digest', { headers: { authorization: 'Bearer digest-secret' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(sendWeeklyDigest).toHaveBeenCalledTimes(1);
  });
});
