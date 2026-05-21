/**
 * Extra coverage tests for supplier-certs routes (GET, PUT) and
 * the GET endpoint of supplier-certs/[id].
 * These are supplementary to suppliers.test.ts.
 */

import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

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
    single: jest.fn().mockResolvedValue({ data: { id: 'sc-001', status: 'approved' }, error: null }),
  },
}));

const mockCert = {
  id: 'sc-001',
  supplier_id: 'sup-001',
  cert_name: 'ISO 9001',
  cert_number: 'ISO-001',
  expiry_date: '2027-01-01',
  issuing_body: 'BIS',
  status: 'pending_review',
  submission_date: '2024-01-01',
  google_drive_file_id: 'drive-001',
};

jest.mock('@/lib/db/supplier-certs', () => ({
  getSupplierCerts: jest.fn().mockResolvedValue([mockCert]),
  getPendingReviewQueue: jest.fn().mockResolvedValue([mockCert]),
  getSupplierCertById: jest.fn().mockResolvedValue(mockCert),
  createSupplierCert: jest.fn().mockResolvedValue({ ...mockCert, id: 'sc-new' }),
  updateSupplierCertStatus: jest.fn().mockResolvedValue({ ...mockCert, status: 'approved' }),
  saveOcrResult: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/db/suppliers', () => ({
  getSuppliers: jest.fn().mockResolvedValue([]),
  getSupplierById: jest.fn().mockResolvedValue({ id: 'sup-001', name: 'Test Supplier Ltd' }),
  createSupplier: jest.fn(),
  updateSupplier: jest.fn().mockResolvedValue({}),
  getSupplierScorecard: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/db/audit-log', () => ({
  appendAuditLog: jest.fn(),
  getAuditLog: jest.fn().mockResolvedValue([]),
  exportAuditLogCsv: jest.fn().mockResolvedValue(''),
}));

jest.mock('@/lib/google-drive', () => ({
  uploadFile: jest.fn().mockResolvedValue({ fileId: 'drive-001', webViewLink: '' }),
  renameFile: jest.fn().mockResolvedValue(undefined),
  getOrCreateFolder: jest.fn().mockResolvedValue('folder-001'),
  generateDownloadLink: jest.fn().mockResolvedValue('https://drive.google.com/download/drive-001'),
}));

jest.mock('@/lib/ocr', () => ({
  extractCertFields: jest.fn().mockResolvedValue({}),
  compareCertFields: jest.fn().mockReturnValue({}),
}));

jest.mock('@/lib/rate-limit', () => ({
  loginLimiter: jest.fn().mockReturnValue(null),
  backupLimiter: jest.fn().mockReturnValue(null),
  ocrLimiter: jest.fn().mockReturnValue(null),
  downloadLimiter: jest.fn().mockReturnValue(null),
  adminLimiter: jest.fn().mockReturnValue(null),
}));

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

function makeSupplierReq(url: string, supplierId: string, init: RequestInit = {}) {
  return new NextRequest(url, {
    ...init,
    headers: {
      'x-supplier-id': supplierId,
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
}

// ─── GET /api/supplier-certs ──────────────────────────────────────────────────

describe('GET /api/supplier-certs', () => {
  it('no auth → 401', async () => {
    const { GET } = require('@/app/api/supplier-certs/route');
    const req = new NextRequest('http://localhost/api/supplier-certs');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('admin → 200 with array of certs (pending queue by default)', async () => {
    const { GET } = require('@/app/api/supplier-certs/route');
    const req = makeAdminReq('http://localhost/api/supplier-certs');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('?status=pending_review → calls getPendingReviewQueue', async () => {
    const { getPendingReviewQueue } = require('@/lib/db/supplier-certs');
    getPendingReviewQueue.mockClear();
    const { GET } = require('@/app/api/supplier-certs/route');
    const req = makeAdminReq('http://localhost/api/supplier-certs?status=pending_review');
    await GET(req);
    expect(getPendingReviewQueue).toHaveBeenCalledTimes(1);
  });

  it('?supplier_id=sup-001 → calls getSupplierCerts with that id', async () => {
    const { getSupplierCerts } = require('@/lib/db/supplier-certs');
    getSupplierCerts.mockClear();
    const { GET } = require('@/app/api/supplier-certs/route');
    const req = makeAdminReq('http://localhost/api/supplier-certs?supplier_id=sup-001');
    await GET(req);
    expect(getSupplierCerts).toHaveBeenCalledWith('sup-001');
  });
});

// ─── GET /api/supplier-certs/[id] ────────────────────────────────────────────

describe('GET /api/supplier-certs/[id]', () => {
  it('admin → 200 with cert data', async () => {
    const { GET } = require('@/app/api/supplier-certs/[id]/route');
    const req = makeAdminReq('http://localhost/api/supplier-certs/sc-001');
    const res = await GET(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id', 'sc-001');
  });

  it('supplier with matching supplier_id → 200', async () => {
    const { GET } = require('@/app/api/supplier-certs/[id]/route');
    const req = makeSupplierReq('http://localhost/api/supplier-certs/sc-001', 'sup-001');
    const res = await GET(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(200);
  });

  it('supplier with non-matching supplier_id → 403', async () => {
    const { GET } = require('@/app/api/supplier-certs/[id]/route');
    // cert belongs to sup-001, but this supplier is sup-999
    const req = makeSupplierReq('http://localhost/api/supplier-certs/sc-001', 'sup-999');
    const res = await GET(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(403);
  });

  it('cert not found → 404', async () => {
    const { getSupplierCertById } = require('@/lib/db/supplier-certs');
    getSupplierCertById.mockResolvedValueOnce(null);
    const { GET } = require('@/app/api/supplier-certs/[id]/route');
    const req = makeAdminReq('http://localhost/api/supplier-certs/nonexistent');
    const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/supplier-certs/[id] ────────────────────────────────────────────

describe('PUT /api/supplier-certs/[id]', () => {
  it('admin → 200 with updated cert data', async () => {
    const { PUT } = require('@/app/api/supplier-certs/[id]/route');
    const req = makeAdminReq('http://localhost/api/supplier-certs/sc-001', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cert_number: 'ISO-001-v2' }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(200);
  });

  it('no auth → 401', async () => {
    const { PUT } = require('@/app/api/supplier-certs/[id]/route');
    const req = new NextRequest('http://localhost/api/supplier-certs/sc-001', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cert_number: 'X' }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(401);
  });

  it('cert not found → 404', async () => {
    const { getSupplierCertById } = require('@/lib/db/supplier-certs');
    getSupplierCertById.mockResolvedValueOnce(null);
    const { PUT } = require('@/app/api/supplier-certs/[id]/route');
    const req = makeAdminReq('http://localhost/api/supplier-certs/gone', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: 'gone' }) });
    expect(res.status).toBe(404);
  });
});

// ─── PATCH validation ─────────────────────────────────────────────────────────

describe('PATCH /api/supplier-certs/[id] — validation', () => {
  it('invalid action → 400', async () => {
    const { PATCH } = require('@/app/api/supplier-certs/[id]/route');
    const req = makeAdminReq('http://localhost/api/supplier-certs/sc-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', reviewer: 'hardik' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(400);
  });

  it('missing reviewer → 400', async () => {
    const { PATCH } = require('@/app/api/supplier-certs/[id]/route');
    const req = makeAdminReq('http://localhost/api/supplier-certs/sc-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(400);
  });
});
