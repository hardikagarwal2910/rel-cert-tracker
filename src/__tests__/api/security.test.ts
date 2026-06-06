/**
 * Security API tests — backup auth, cron secret, download tokens,
 * error response sanitisation, role enforcement.
 */

import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

jest.mock('@/lib/db/audit-log', () => ({
  appendAuditLog: jest.fn(),
  getAuditLog: jest.fn().mockResolvedValue([]),
  exportAuditLogCsv: jest.fn().mockResolvedValue(''),
}));

jest.mock('@/lib/db/certificates', () => ({
  getCertificates: jest.fn().mockResolvedValue([]),
  getCertificateById: jest.fn().mockResolvedValue(null),
  getExpiringSoon: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/db/notification-log', () => ({
  getNotificationsByCert: jest.fn().mockResolvedValue([]),
  logNotification: jest.fn().mockResolvedValue(undefined),
}));

// Cron route also runs supplier reminders — provide empty supplier data.
jest.mock('@/lib/db/supplier-certs', () => ({
  getExpiringSupplierCerts: jest.fn().mockResolvedValue([]),
  getSupplierCerts: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/db/suppliers', () => ({
  getSupplierById: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/db/download-tokens', () => ({
  validateAndUseToken: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/mailer', () => ({
  sendCertExpiryReminder: jest.fn().mockResolvedValue({ success: true }),
  sendSupplierExpiryReminder: jest.fn().mockResolvedValue({ success: true }),
  sendPortalInvite: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/google-drive', () => ({
  generateDownloadLink: jest.fn().mockResolvedValue('https://drive.google.com/file/test'),
}));

jest.mock('@/lib/rate-limit', () => ({
  loginLimiter: jest.fn().mockReturnValue(null),
  backupLimiter: jest.fn().mockReturnValue(null),
  ocrLimiter: jest.fn().mockReturnValue(null),
  downloadLimiter: jest.fn().mockReturnValue(null),
  adminLimiter: jest.fn().mockReturnValue(null),
}));

// Mock archiver to avoid native module issues in tests
jest.mock('archiver', () => {
  const { EventEmitter } = require('events');
  return jest.fn(() => {
    const emitter = new EventEmitter();
    const archive = {
      ...emitter,
      on: emitter.on.bind(emitter),
      append: jest.fn(),
      finalize: jest.fn(() => {
        emitter.emit('data', Buffer.from('PK'));
        emitter.emit('end');
      }),
    };
    return archive;
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAdminReq(url: string, init: RequestInit = {}) {
  return new NextRequest(url, {
    ...init,
    headers: {
      'x-user-id': 'user-001',
      'x-user-role': 'admin',
      'x-user-name': 'hardik',
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
}

function makeStaffReq(url: string, init: RequestInit = {}) {
  return new NextRequest(url, {
    ...init,
    headers: {
      'x-user-id': 'user-002',
      'x-user-role': 'staff',
      'x-user-name': 'staffuser',
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
}

// ─── Backup endpoint ──────────────────────────────────────────────────────────

describe('GET /api/backup — role enforcement', () => {
  it('no auth headers → 401', async () => {
    const { GET } = require('@/app/api/backup/route');
    const req = new NextRequest('http://localhost/api/backup');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('staff role → 403 (backup is admin-only)', async () => {
    const { GET } = require('@/app/api/backup/route');
    const req = makeStaffReq('http://localhost/api/backup');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('admin role → 200 with zip content-type', async () => {
    const { GET } = require('@/app/api/backup/route');
    const req = makeAdminReq('http://localhost/api/backup');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-disposition')).toContain('REL_Backup_');
  });

  it('backup response is ZIP not JSON (no credential leakage via JSON)', async () => {
    const { GET } = require('@/app/api/backup/route');
    const req = makeAdminReq('http://localhost/api/backup');
    const res = await GET(req);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-type')).not.toContain('json');
  });
});

// ─── Cron endpoint — CRON_SECRET enforcement ─────────────────────────────────

describe('GET /api/cron/notifications — secret enforcement', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = 'test-cron-secret-xyz';
    process.env.NOTIFICATION_EMAIL = 'notify@test.com';
  });

  afterAll(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NOTIFICATION_EMAIL;
  });

  it('no authorization header → 401', async () => {
    const { GET } = require('@/app/api/cron/notifications/route');
    const req = new NextRequest('http://localhost/api/cron/notifications');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('wrong secret → 401', async () => {
    const { GET } = require('@/app/api/cron/notifications/route');
    const req = new NextRequest('http://localhost/api/cron/notifications', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('correct secret → 200 with processed count', async () => {
    const { GET } = require('@/app/api/cron/notifications/route');
    const req = new NextRequest('http://localhost/api/cron/notifications', {
      headers: { authorization: 'Bearer test-cron-secret-xyz' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('processed');
    expect(typeof body.processed).toBe('number');
  });

  it('truncated secret → 401 (must be exact match)', async () => {
    const { GET } = require('@/app/api/cron/notifications/route');
    const req = new NextRequest('http://localhost/api/cron/notifications', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/cron/notifications — manual trigger role enforcement', () => {
  it('no auth → 401', async () => {
    const { POST } = require('@/app/api/cron/notifications/route');
    const req = new NextRequest('http://localhost/api/cron/notifications', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('staff → 403', async () => {
    const { POST } = require('@/app/api/cron/notifications/route');
    const req = makeStaffReq('http://localhost/api/cron/notifications', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('admin → 200 with processed count', async () => {
    const { POST } = require('@/app/api/cron/notifications/route');
    const req = makeAdminReq('http://localhost/api/cron/notifications', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('processed');
  });
});

// ─── Download token endpoint ──────────────────────────────────────────────────

describe('GET /api/download/[token] — token validation', () => {
  it('invalid / expired token → 403', async () => {
    const { validateAndUseToken } = require('@/lib/db/download-tokens');
    validateAndUseToken.mockResolvedValueOnce(null);

    const { GET } = require('@/app/api/download/[token]/route');
    const req = new NextRequest('http://localhost/api/download/bad-token-abc');
    const res = await GET(req, { params: Promise.resolve({ token: 'bad-token-abc' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/invalid|expired|used/i);
  });

  it('valid token but cert not found → 404', async () => {
    const { validateAndUseToken } = require('@/lib/db/download-tokens');
    const { getCertificateById } = require('@/lib/db/certificates');

    validateAndUseToken.mockResolvedValueOnce({ certId: 'cert-999', buyerEmail: 'buyer@test.com' });
    getCertificateById.mockResolvedValueOnce(null);

    const { GET } = require('@/app/api/download/[token]/route');
    const req = new NextRequest('http://localhost/api/download/valid-token');
    const res = await GET(req, { params: Promise.resolve({ token: 'valid-token' }) });
    expect(res.status).toBe(404);
  });

  it('valid token + valid cert → redirect to Drive URL', async () => {
    const { validateAndUseToken } = require('@/lib/db/download-tokens');
    const { getCertificateById } = require('@/lib/db/certificates');
    const { generateDownloadLink } = require('@/lib/google-drive');

    validateAndUseToken.mockResolvedValueOnce({ certId: 'cert-001', buyerEmail: 'buyer@test.com' });
    getCertificateById.mockResolvedValueOnce({
      id: 'cert-001',
      name: 'ISO 9001',
      google_drive_file_id: 'drive-001',
    });
    generateDownloadLink.mockResolvedValueOnce('https://drive.google.com/download/drive-001');

    const { GET } = require('@/app/api/download/[token]/route');
    const req = new NextRequest('http://localhost/api/download/valid-token-2');
    const res = await GET(req, { params: Promise.resolve({ token: 'valid-token-2' }) });
    // NextResponse.redirect returns 307/302
    expect([302, 307, 308]).toContain(res.status);
  });
});

// ─── Error response sanitisation ─────────────────────────────────────────────

describe('Error responses — no stack traces or secrets leaked', () => {
  it('download error response has no stack trace', async () => {
    const { validateAndUseToken } = require('@/lib/db/download-tokens');
    validateAndUseToken.mockRejectedValueOnce(
      new Error('DB connection failed at line 42 in /usr/src/app/node_modules/pg')
    );

    const { GET } = require('@/app/api/download/[token]/route');
    const req = new NextRequest('http://localhost/api/download/throws-token');
    const res = await GET(req, { params: Promise.resolve({ token: 'throws-token' }) });
    expect(res.status).toBe(500);

    const body = await res.json();
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('line 42');
    expect(bodyStr).not.toContain('/usr/src/app');
    expect(body).toHaveProperty('error');
  });

  it('cron error response body contains no sensitive content', async () => {
    const { getExpiringSoon } = require('@/lib/db/certificates');
    getExpiringSoon.mockRejectedValueOnce(new Error('secret_key=sk-ant-abc123 connection refused'));

    process.env.CRON_SECRET = 'sanitise-test-secret';
    process.env.NOTIFICATION_EMAIL = 'x@test.com';

    const { GET } = require('@/app/api/cron/notifications/route');
    const req = new NextRequest('http://localhost/api/cron/notifications', {
      headers: { authorization: 'Bearer sanitise-test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('sk-ant-');
    expect(bodyStr).not.toContain('secret_key');
    expect(body.error).toBeDefined();

    delete process.env.CRON_SECRET;
    delete process.env.NOTIFICATION_EMAIL;
  });
});
