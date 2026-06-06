/**
 * v1.1.6 — PDF upload regression + staff add-only permissions (route layer).
 */
import { NextRequest } from 'next/server';

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
  isAuthResult: jest.fn((r: unknown) => !(r && typeof r === 'object' && 'headers' in r)),
  requireSupplierAuth: jest.fn(),
  verifySupplierToken: jest.fn(),
}));

jest.mock('@/lib/db/certificates', () => ({
  getCertificateById: jest.fn().mockResolvedValue({ id: 'cert-001', name: 'ISO 9001', version_history: [], google_drive_file_id: null }),
  updateCertificate: jest.fn().mockResolvedValue({ id: 'cert-001' }),
}));
jest.mock('@/lib/db/cert-documents', () => ({
  createCertDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
}));
jest.mock('@/lib/google-drive', () => ({
  uploadFile: jest.fn().mockResolvedValue({ fileId: 'drive-1', webViewLink: 'https://drive/x' }),
  getOrCreateFolder: jest.fn().mockResolvedValue('folder-1'),
  renameFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/db/locations', () => ({
  getLocations: jest.fn().mockResolvedValue([]),
  createLocation: jest.fn().mockResolvedValue({ id: 'loc-new', name: 'REL' }),
  updateLocation: jest.fn().mockResolvedValue({ id: 'loc-1', name: 'REL' }),
  deactivateLocation: jest.fn().mockResolvedValue(undefined),
  reactivateLocation: jest.fn().mockResolvedValue(undefined),
  getLocationById: jest.fn().mockResolvedValue({ id: 'loc-1', name: 'REL', active: true }),
  getCertCountByLocation: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/db/suppliers', () => ({
  getSuppliers: jest.fn().mockResolvedValue([]),
  createSupplier: jest.fn().mockResolvedValue({ id: 'sup-new', name: 'Acme' }),
  getSupplierById: jest.fn().mockResolvedValue({ id: 'sup-1', name: 'Acme', status: 'active' }),
  updateSupplier: jest.fn().mockResolvedValue({ id: 'sup-1', name: 'Acme' }),
  getSupplierScorecard: jest.fn().mockResolvedValue({}),
  archiveSupplier: jest.fn().mockResolvedValue({ id: 'sup-1', name: 'Acme', status: 'inactive' }),
  reactivateSupplier: jest.fn().mockResolvedValue({ id: 'sup-1', name: 'Acme', status: 'active' }),
}));

jest.mock('@/lib/db/audit-log', () => ({ appendAuditLog: jest.fn() }));

function jsonReq(url: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') {
  return new NextRequest(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
const admin = { 'x-user-id': 'a1', 'x-user-role': 'admin', 'x-user-name': 'hardik' };
const staff = { 'x-user-id': 's1', 'x-user-role': 'staff', 'x-user-name': 'staffy' };

// ── TASK A: upload route regression (Drive mocked) ────────────────────────────
describe('POST /api/certificates/[id]/upload-pdf', () => {
  const params = { params: Promise.resolve({ id: 'cert-001' }) };
  function pdfReq(headers = admin) {
    const fd = new FormData();
    fd.append('file', new File(['%PDF-1.4 hello'], 'cert.pdf', { type: 'application/pdf' }));
    fd.append('doc_type', 'certificate');
    return new NextRequest('http://localhost/api/certificates/cert-001/upload-pdf', { method: 'POST', headers, body: fd });
  }

  it('success path → 200, uploads + records document', async () => {
    const { uploadFile } = require('@/lib/google-drive');
    const { createCertDocument } = require('@/lib/db/cert-documents');
    uploadFile.mockClear(); createCertDocument.mockClear();
    const { POST } = require('@/app/api/certificates/[id]/upload-pdf/route');
    const res = await POST(pdfReq(), params);
    expect(res.status).toBe(200);
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(createCertDocument).toHaveBeenCalledTimes(1);
  });

  it('Drive failure → clean 500 (no crash, generic message)', async () => {
    const { uploadFile } = require('@/lib/google-drive');
    uploadFile.mockRejectedValueOnce(new Error('invalid_grant: account not found'));
    const { POST } = require('@/app/api/certificates/[id]/upload-pdf/route');
    const res = await POST(pdfReq(), params);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('An internal error occurred');
    expect(JSON.stringify(body)).not.toContain('invalid_grant'); // real error not leaked to client
  });
});

// ── TASK B: staff add-only permissions ────────────────────────────────────────
describe('Locations — staff may add, not edit/deactivate', () => {
  it('staff POST /api/locations → 201 and persists address fields', async () => {
    const { createLocation } = require('@/lib/db/locations');
    createLocation.mockClear();
    const { POST } = require('@/app/api/locations/route');
    const res = await POST(jsonReq('http://localhost/api/locations', {
      name: 'Raghuvir Exim Limited', address_line_1: 'Plot 42', city: 'Ahmedabad', state: 'Gujarat', pincode: '380058',
    }, staff));
    expect(res.status).toBe(201);
    expect(createLocation).toHaveBeenCalledTimes(1);
    expect(createLocation.mock.calls[0][0]).toMatchObject({ address_line_1: 'Plot 42', city: 'Ahmedabad', pincode: '380058' });
  });

  it('staff PUT /api/locations/[id] → 403', async () => {
    const { PUT } = require('@/app/api/locations/[id]/route');
    const res = await PUT(jsonReq('http://localhost/api/locations/loc-1', { name: 'X' }, staff, 'PUT'), { params: Promise.resolve({ id: 'loc-1' }) });
    expect(res.status).toBe(403);
  });

  it('staff PATCH /api/locations/[id] (deactivate) → 403', async () => {
    const { PATCH } = require('@/app/api/locations/[id]/route');
    const res = await PATCH(jsonReq('http://localhost/api/locations/loc-1', { action: 'deactivate' }, staff, 'PATCH'), { params: Promise.resolve({ id: 'loc-1' }) });
    expect(res.status).toBe(403);
  });

  it('admin PUT /api/locations/[id] → 200', async () => {
    const { PUT } = require('@/app/api/locations/[id]/route');
    const res = await PUT(jsonReq('http://localhost/api/locations/loc-1', { name: 'X' }, admin, 'PUT'), { params: Promise.resolve({ id: 'loc-1' }) });
    expect(res.status).toBe(200);
  });
});

describe('Suppliers — staff may add, not edit', () => {
  it('staff POST /api/suppliers → 201 and persists address fields', async () => {
    const { createSupplier } = require('@/lib/db/suppliers');
    createSupplier.mockClear();
    const { POST } = require('@/app/api/suppliers/route');
    const res = await POST(jsonReq('http://localhost/api/suppliers', {
      name: 'Acme Mills', city: 'Surat', state: 'Gujarat', pincode: '395003', address_line_1: 'Unit 9',
    }, staff));
    expect(res.status).toBe(201);
    expect(createSupplier).toHaveBeenCalledTimes(1);
    expect(createSupplier.mock.calls[0][0]).toMatchObject({ address_line_1: 'Unit 9', city: 'Surat' });
  });

  it('staff PUT /api/suppliers/[id] → 403', async () => {
    const { PUT } = require('@/app/api/suppliers/[id]/route');
    const res = await PUT(jsonReq('http://localhost/api/suppliers/sup-1', { name: 'X' }, staff, 'PUT'), { params: Promise.resolve({ id: 'sup-1' }) });
    expect(res.status).toBe(403);
  });

  it('admin PUT /api/suppliers/[id] → 200', async () => {
    const { PUT } = require('@/app/api/suppliers/[id]/route');
    const res = await PUT(jsonReq('http://localhost/api/suppliers/sup-1', { name: 'X' }, admin, 'PUT'), { params: Promise.resolve({ id: 'sup-1' }) });
    expect(res.status).toBe(200);
  });

  it('staff PATCH /api/suppliers/[id] (archive) → 403', async () => {
    const { PATCH } = require('@/app/api/suppliers/[id]/route');
    const res = await PATCH(jsonReq('http://localhost/api/suppliers/sup-1', { action: 'archive' }, staff, 'PATCH'), { params: Promise.resolve({ id: 'sup-1' }) });
    expect(res.status).toBe(403);
  });
});
