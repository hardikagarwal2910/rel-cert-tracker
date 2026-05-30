/**
 * Bulk supplier onboarding route. Uses the REAL createSupplier + real
 * encryption so we can assert contacts are stored ENCRYPTED. The Supabase
 * client is mocked to capture insert payloads.
 */

import { NextRequest } from 'next/server';

let mockInserts: Array<Record<string, unknown>> = [];

jest.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'update']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.insert = jest.fn((payload: Record<string, unknown>) => {
    mockInserts.push(payload);
    return chain;
  });
  chain.single = jest.fn(() =>
    Promise.resolve({
      data: mockInserts[mockInserts.length - 1] ?? { id: 'x', contacts: [] },
      error: null,
    })
  );
  (chain as { then: unknown }).then = (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(onFulfilled);
  return { adminClient: chain };
});

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
}));

jest.mock('@/lib/db/audit-log', () => ({ appendAuditLog: jest.fn() }));

jest.mock('@/lib/rate-limit', () => ({
  loginLimiter: jest.fn().mockReturnValue(null),
  backupLimiter: jest.fn().mockReturnValue(null),
  ocrLimiter: jest.fn().mockReturnValue(null),
  downloadLimiter: jest.fn().mockReturnValue(null),
  adminLimiter: jest.fn().mockReturnValue(null),
}));

import { decrypt } from '@/lib/encryption';

const CSV = [
  'Supplier Name,Tier,Commodity Tags,Address Line 1,Address Line 2,City,State,Pincode,Country,Buyer Links,Contact Name,Contact Email,Contact Phone',
  'Acme Foods,1,rice,Addr 1,,Ahmedabad,Gujarat,380001,India,Reliance,Jane,jane@acme.com,+919999999',
  'Beta Mills,2,wheat,Addr 2,,Surat,Gujarat,395001,India,,John,john@beta.com,',
  ',1,rice,,,Nowhere,Gujarat,000000,India,,NoEmail,,',
].join('\n');

function uploadReq(preview: boolean) {
  const fd = new FormData();
  fd.append('file', new File([CSV], 'suppliers.csv', { type: 'text/csv' }));
  const url = `http://localhost/api/bulk-import/suppliers${preview ? '?preview=true' : ''}`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'x-user-id': 'user-001', 'x-user-role': 'admin', 'x-user-name': 'hardik' },
    body: fd,
  });
}

describe('POST /api/bulk-import/suppliers', () => {
  beforeEach(() => {
    mockInserts = [];
  });

  it('no auth → 401', async () => {
    const { POST } = require('@/app/api/bulk-import/suppliers/route');
    const fd = new FormData();
    fd.append('file', new File([CSV], 'suppliers.csv', { type: 'text/csv' }));
    const res = await POST(new NextRequest('http://localhost/api/bulk-import/suppliers', { method: 'POST', body: fd }));
    expect(res.status).toBe(401);
  });

  it('preview mode validates rows WITHOUT importing', async () => {
    const { POST } = require('@/app/api/bulk-import/suppliers/route');
    const res = await POST(uploadReq(true));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.valid).toBe(2);
    expect(body.invalid).toBe(1);
    expect(body.rows).toHaveLength(3);
    expect(mockInserts.length).toBe(0); // nothing imported in preview
  });

  it('import creates valid suppliers with ENCRYPTED contacts, skips invalid', async () => {
    const { POST } = require('@/app/api/bulk-import/suppliers/route');
    const res = await POST(uploadReq(false));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(2);
    expect(body.invalid).toBe(1);

    // Two suppliers inserted
    expect(mockInserts.length).toBe(2);

    // Contact email is stored ENCRYPTED, not plaintext
    const firstContacts = mockInserts[0].contacts as Array<{ email: string }>;
    expect(firstContacts[0].email).not.toBe('jane@acme.com');
    expect(decrypt(firstContacts[0].email)).toBe('jane@acme.com');
  });

  it('GET returns a CSV template with the correct headers', async () => {
    const { GET } = require('@/app/api/bulk-import/suppliers/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('csv');
    const text = await res.text();
    expect(text).toContain('Supplier Name');
    expect(text).toContain('Contact Email');
  });
});
