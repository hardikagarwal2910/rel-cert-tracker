/**
 * Certificate API tests
 */

import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock auth middleware — reads role from x-user-role header (set by tests)
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
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

const mockCerts = [
  {
    id: 'cert-001',
    name: 'ISO 9001',
    expiry_date: '2026-12-31',
    status: 'active',
    buyer_tags: ['reliance', 'tata'],
    version_history: [],
    submitted_by_supplier: false,
    category: 'Quality',
    location_id: 'loc-001',
    buyer_visible: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'cert-002',
    name: 'Supplier Cert',
    expiry_date: '2026-06-30',
    status: 'expiring_soon',
    buyer_tags: [],
    version_history: [],
    submitted_by_supplier: true,
    buyer_visible: false,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

jest.mock('@/lib/db/certificates', () => ({
  getCertificates: jest.fn().mockResolvedValue(mockCerts),
  getCertificateById: jest.fn().mockResolvedValue(mockCerts[0]),
  createCertificate: jest.fn().mockResolvedValue({ ...mockCerts[0], id: 'cert-new' }),
  updateCertificate: jest.fn().mockResolvedValue(mockCerts[0]),
  renewCertificate: jest.fn().mockResolvedValue({
    ...mockCerts[0],
    expiry_date: '2027-12-31',
    version_history: [{ version: 1, expiry_date: '2026-12-31' }],
  }),
  deleteCertificate: jest.fn().mockResolvedValue(undefined),
  getExpiringSoon: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/db/audit-log', () => ({
  appendAuditLog: jest.fn(),
  getAuditLog: jest.fn().mockResolvedValue([]),
  exportAuditLogCsv: jest.fn().mockResolvedValue(''),
}));

jest.mock('@/lib/google-drive', () => ({
  uploadFile: jest.fn().mockResolvedValue({ fileId: 'drive-file-001', webViewLink: 'https://drive.google.com/file/drive-file-001' }),
  renameFile: jest.fn().mockResolvedValue(undefined),
  getOrCreateFolder: jest.fn().mockResolvedValue('folder-001'),
  generateDownloadLink: jest.fn().mockResolvedValue('https://drive.google.com/download/drive-file-001'),
  getCertFolderStructure: jest.fn().mockResolvedValue('folder-001'),
}));

jest.mock('@/lib/rate-limit', () => ({
  loginLimiter: jest.fn().mockReturnValue(null),
  backupLimiter: jest.fn().mockReturnValue(null),
  ocrLimiter: jest.fn().mockReturnValue(null),
  downloadLimiter: jest.fn().mockReturnValue(null),
  adminLimiter: jest.fn().mockReturnValue(null),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuthRequest(url: string, init: RequestInit = {}, role = 'admin') {
  const headers: Record<string, string> = {
    'x-user-id': 'user-001',
    'x-user-role': role,
    'x-user-name': 'hardik',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  return new NextRequest(url, { ...init, headers });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/certificates', () => {
  it('without auth headers → 401', async () => {
    const { GET } = require('@/app/api/certificates/route');
    const req = new NextRequest('http://localhost/api/certificates');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('with admin auth → 200, returns array of certs', async () => {
    const { GET } = require('@/app/api/certificates/route');
    const req = makeAuthRequest('http://localhost/api/certificates');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('each cert has required fields with correct types', async () => {
    const { GET } = require('@/app/api/certificates/route');
    const req = makeAuthRequest('http://localhost/api/certificates');
    const res = await GET(req);
    const body = await res.json();
    for (const cert of body) {
      expect(cert).toHaveProperty('id');
      expect(cert).toHaveProperty('name');
      expect(cert).toHaveProperty('status');
      expect(cert).toHaveProperty('expiry_date');
      expect(Array.isArray(cert.buyer_tags)).toBe(true);
      expect(Array.isArray(cert.version_history)).toBe(true);
    }
  });

  it('?view=supplier passes view=supplier filter to DB', async () => {
    const { getCertificates } = require('@/lib/db/certificates');
    const { GET } = require('@/app/api/certificates/route');
    getCertificates.mockClear();
    const req = makeAuthRequest('http://localhost/api/certificates?view=supplier');
    await GET(req);
    expect(getCertificates).toHaveBeenCalledWith(
      expect.objectContaining({ view: 'supplier' })
    );
  });

  it('?view=internal passes view=internal filter to DB', async () => {
    const { getCertificates } = require('@/lib/db/certificates');
    const { GET } = require('@/app/api/certificates/route');
    getCertificates.mockClear();
    const req = makeAuthRequest('http://localhost/api/certificates?view=internal');
    await GET(req);
    expect(getCertificates).toHaveBeenCalledWith(
      expect.objectContaining({ view: 'internal' })
    );
  });
});

describe('POST /api/certificates', () => {
  it('valid body → 201 with cert data', async () => {
    const { POST } = require('@/app/api/certificates/route');
    const req = makeAuthRequest('http://localhost/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'ISO 14001',
        expiry_date: '2027-01-01',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  it('missing expiry_date → 400 validation error', async () => {
    const { POST } = require('@/app/api/certificates/route');
    const req = makeAuthRequest('http://localhost/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Cert' }),  // missing expiry_date
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('missing name → 400 validation error', async () => {
    const { POST } = require('@/app/api/certificates/route');
    const req = makeAuthRequest('http://localhost/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiry_date: '2027-01-01' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('calls appendAuditLog once on create', async () => {
    const { appendAuditLog } = require('@/lib/db/audit-log');
    appendAuditLog.mockClear();
    const { POST } = require('@/app/api/certificates/route');
    const req = makeAuthRequest('http://localhost/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Cert', expiry_date: '2027-06-01' }),
    });
    await POST(req);
    expect(appendAuditLog).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/certificates/[id]/upload-pdf', () => {
  it('non-PDF file → 400 with "PDF" in error', async () => {
    const { POST } = require('@/app/api/certificates/[id]/upload-pdf/route');
    const formData = new FormData();
    const file = new File(['not a pdf'], 'test.txt', { type: 'text/plain' });
    formData.append('file', file);

    const req = makeAuthRequest(
      'http://localhost/api/certificates/cert-001/upload-pdf',
      { method: 'POST', body: formData }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'cert-001' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('PDF');
  });

  it('file > 20MB → 400', async () => {
    const { POST } = require('@/app/api/certificates/[id]/upload-pdf/route');
    const formData = new FormData();
    const bigBuffer = Buffer.alloc(21 * 1024 * 1024, 'x');
    const file = new File([bigBuffer], 'big.pdf', { type: 'application/pdf' });
    formData.append('file', file);

    const req = makeAuthRequest(
      'http://localhost/api/certificates/cert-001/upload-pdf',
      { method: 'POST', body: formData }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'cert-001' }) });
    expect(res.status).toBe(400);
  });

  it('valid PDF → 200 and calls Drive uploadFile', async () => {
    const { uploadFile } = require('@/lib/google-drive');
    uploadFile.mockClear();

    const { POST } = require('@/app/api/certificates/[id]/upload-pdf/route');
    const formData = new FormData();
    const file = new File(['%PDF-1.4 content'], 'cert.pdf', { type: 'application/pdf' });
    formData.append('file', file);

    const req = makeAuthRequest(
      'http://localhost/api/certificates/cert-001/upload-pdf',
      { method: 'POST', body: formData }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'cert-001' }) });
    expect(res.status).toBe(200);
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/certificates/[id]/renew', () => {
  it('returns 200 with version_history entry for old expiry', async () => {
    const { renewCertificate } = require('@/lib/db/certificates');
    renewCertificate.mockClear();

    const { POST } = require('@/app/api/certificates/[id]/renew/route');
    const req = makeAuthRequest(
      'http://localhost/api/certificates/cert-001/renew',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_expiry_date: '2027-12-31' }),
      }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'cert-001' }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.version_history.length).toBeGreaterThan(0);
    expect(body.version_history[0]).toHaveProperty('expiry_date', '2026-12-31');
    expect(renewCertificate).toHaveBeenCalledWith(
      'cert-001',
      expect.objectContaining({ new_expiry_date: '2027-12-31' })
    );
  });

  it('missing new_expiry_date → 400', async () => {
    const { POST } = require('@/app/api/certificates/[id]/renew/route');
    const req = makeAuthRequest(
      'http://localhost/api/certificates/cert-001/renew',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    const res = await POST(req, { params: Promise.resolve({ id: 'cert-001' }) });
    expect(res.status).toBe(400);
  });
});
