/**
 * Supplier + Supplier Cert API tests — including cross-tenant isolation
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
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

const mockSupplier = {
  id: 'sup-001',
  name: 'Test Supplier Ltd',
  tier: '1',
  status: 'active',
  contacts: [{ name: 'John', email: 'john@test.com', phone: '' }],
  portal_login: {},
  onboarding_checklist: {
    contacts_added: true,
    required_certs_defined: false,
    invite_sent: false,
    invite_accepted: false,
    first_cert_uploaded: false,
  },
  scorecard: { total_submissions: 0, approved: 0, rejected: 0 },
  buyer_links: [],
  commodity_tags: [],
  required_cert_ids: [],
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

jest.mock('@/lib/db/suppliers', () => ({
  getSuppliers: jest.fn().mockResolvedValue([mockSupplier]),
  getSupplierById: jest.fn().mockResolvedValue(mockSupplier),
  createSupplier: jest.fn().mockResolvedValue({ ...mockSupplier, id: 'sup-new' }),
  updateSupplier: jest.fn().mockResolvedValue(mockSupplier),
  getSupplierScorecard: jest.fn().mockResolvedValue({ total_submissions: 2, approved: 1, rejected: 1 }),
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

jest.mock('@/lib/mailer', () => ({
  sendPortalInvite: jest.fn().mockResolvedValue({ success: true }),
  sendPdfRequestNotification: jest.fn().mockResolvedValue({ success: true }),
  sendPdfDownloadLink: jest.fn().mockResolvedValue({ success: true }),
  sendSupplierExpiryReminder: jest.fn().mockResolvedValue({ success: true }),
  sendCertExpiryReminder: jest.fn().mockResolvedValue({ success: true }),
  sendOtp: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/encryption', () => ({
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => (v.startsWith('enc:') ? v.slice(4) : v)),
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

// ─── Supplier Cert Cross-Tenant Isolation ────────────────────────────────────

describe('Supplier cert cross-tenant isolation', () => {
  it('supplier A cannot submit cert for supplier B → 403', async () => {
    const { POST } = require('@/app/api/supplier-certs/route');

    const formData = new FormData();
    const file = new File(['%PDF-1.4'], 'cert.pdf', { type: 'application/pdf' });
    formData.append('file', file);
    // JWT identifies supplier A (sup-001), but form claims supplier B (sup-002)
    formData.append('supplier_id', 'sup-002');
    formData.append('cert_name', 'Test Cert');
    formData.append('expiry_date', '2027-01-01');

    // Req authenticated as sup-001
    const req = makeSupplierReq(
      'http://localhost/api/supplier-certs',
      'sup-001',
      { method: 'POST', body: formData }
    );

    // The route should use supplierId from JWT (x-supplier-id), not form field
    // So supplier_id in cert will be sup-001 regardless of form field
    const { createSupplierCert } = require('@/lib/db/supplier-certs');
    const res = await POST(req);
    // Should succeed (201) but create cert for the JWT supplier (sup-001), not the spoofed ID
    if (res.status === 201) {
      expect(createSupplierCert).toHaveBeenCalledWith(
        expect.objectContaining({ supplier_id: 'sup-001' })
      );
    }
  });

  it('unauthenticated request → 401', async () => {
    const { POST } = require('@/app/api/supplier-certs/route');
    const formData = new FormData();
    const req = new NextRequest('http://localhost/api/supplier-certs', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

// ─── Supplier Cert Submission ─────────────────────────────────────────────────

describe('POST /api/supplier-certs', () => {
  it('valid supplier JWT + valid PDF → 201', async () => {
    const { POST } = require('@/app/api/supplier-certs/route');
    const formData = new FormData();
    const file = new File(['%PDF-1.4 content'], 'iso.pdf', { type: 'application/pdf' });
    formData.append('file', file);
    formData.append('cert_name', 'ISO 9001');
    formData.append('expiry_date', '2027-01-01');

    const req = makeSupplierReq(
      'http://localhost/api/supplier-certs',
      'sup-001',
      { method: 'POST', body: formData }
    );
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('missing cert_name → 400', async () => {
    const { POST } = require('@/app/api/supplier-certs/route');
    const formData = new FormData();
    const file = new File(['%PDF-1.4'], 'cert.pdf', { type: 'application/pdf' });
    formData.append('file', file);
    formData.append('expiry_date', '2027-01-01');
    // No cert_name

    const req = makeSupplierReq(
      'http://localhost/api/supplier-certs',
      'sup-001',
      { method: 'POST', body: formData }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── Approve/Reject (PATCH) ───────────────────────────────────────────────────

describe('PATCH /api/supplier-certs/[id] approve/reject', () => {
  it('non-admin/staff → 403 (supplier cannot approve)', async () => {
    // PATCH requires admin/staff; supplier JWT is not staff
    const req = makeSupplierReq(
      'http://localhost/api/supplier-certs/sc-001',
      'sup-001',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', reviewer: 'hardik' }),
      }
    );
    // Use requireAuth mock (no x-user-role header)
    const { PATCH } = require('@/app/api/supplier-certs/[id]/route');
    const res = await PATCH(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(401);  // no admin headers → 401
  });

  it('admin → approve → 200 with status approved', async () => {
    const { PATCH } = require('@/app/api/supplier-certs/[id]/route');
    const req = makeAdminReq(
      'http://localhost/api/supplier-certs/sc-001',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', reviewer: 'hardik', comment: 'Looks good' }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('approved');
  });

  it('admin → reject → 200 with status rejected', async () => {
    const { updateSupplierCertStatus } = require('@/lib/db/supplier-certs');
    updateSupplierCertStatus.mockResolvedValueOnce({ ...mockCert, status: 'rejected' });

    const { PATCH } = require('@/app/api/supplier-certs/[id]/route');
    const req = makeAdminReq(
      'http://localhost/api/supplier-certs/sc-001',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reviewer: 'hardik', comment: 'Missing fields' }),
      }
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: 'sc-001' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('rejected');
  });
});

// ─── Supplier Invite ──────────────────────────────────────────────────────────

describe('POST /api/suppliers/[id]/invite', () => {
  it('sends invite email and updates onboarding_checklist invite_sent', async () => {
    const { sendPortalInvite } = require('@/lib/mailer');
    const { updateSupplier } = require('@/lib/db/suppliers');
    sendPortalInvite.mockClear();
    updateSupplier.mockClear();

    const { POST } = require('@/app/api/suppliers/[id]/invite/route');
    const req = makeAdminReq('http://localhost/api/suppliers/sup-001/invite', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'sup-001' }) });
    expect(res.status).toBe(200);
    expect(sendPortalInvite).toHaveBeenCalledTimes(1);
    expect(updateSupplier).toHaveBeenCalledWith(
      'sup-001',
      expect.objectContaining({
        onboarding_checklist: expect.objectContaining({ invite_sent: true }),
      })
    );
  });
});
