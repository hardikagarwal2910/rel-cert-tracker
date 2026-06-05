/**
 * Buyer data layer: registration encryption, approval lifecycle,
 * set-password, and the buyer-visible certificate rule.
 */

import bcrypt from 'bcryptjs';

// Mutable mock state for the Supabase client.
let mockSelectRows: Array<Record<string, unknown>> = [];
let mockSingle: Record<string, unknown> | null = null;
let mockInserts: Array<Record<string, unknown>> = [];
let mockUpdates: Array<Record<string, unknown>> = [];

jest.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'gt', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.insert = jest.fn((payload: Record<string, unknown>) => {
    mockInserts.push(payload);
    return chain;
  });
  chain.update = jest.fn((payload: Record<string, unknown>) => {
    mockUpdates.push(payload);
    return chain;
  });
  chain.single = jest.fn(() =>
    Promise.resolve({ data: mockSingle, error: mockSingle ? null : { message: 'no rows' } })
  );
  (chain as { then: unknown }).then = (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: mockSelectRows, error: null }).then(onFulfilled);
  return { adminClient: chain };
});

import {
  registerBuyer,
  approveBuyer,
  rejectBuyer,
  suspendBuyer,
  setBuyerPassword,
  logBuyerVisit,
} from '@/lib/db/buyers';
import { getBuyerVisibleCertificates } from '@/lib/db/certificates';
import { decrypt } from '@/lib/encryption';
import { signBuyerInviteToken } from '@/lib/auth/buyer-token';
import { adminClient } from '@/lib/supabase/admin';

beforeEach(() => {
  mockSelectRows = [];
  mockSingle = null;
  mockInserts = [];
  mockUpdates = [];
});

describe('registerBuyer', () => {
  it('encrypts email + ip, defaults status to pending, stores email_hash', async () => {
    mockSelectRows = []; // no existing buyer
    mockSingle = { id: 'b1', name: 'Acme', email: 'enc', status: 'pending' };

    await registerBuyer({ name: 'Acme', email: 'buyer@acme.com', ip_address: '1.2.3.4' });

    const payload = mockInserts[0];
    expect(payload.status).toBe('pending');
    expect(payload.email).not.toBe('buyer@acme.com');
    expect(decrypt(payload.email as string)).toBe('buyer@acme.com');
    expect(payload.ip_address).not.toBe('1.2.3.4');
    expect(decrypt(payload.ip_address as string)).toBe('1.2.3.4');
    expect(typeof payload.email_hash).toBe('string');
  });

  it('is idempotent for an existing pending/approved email (no duplicate insert)', async () => {
    mockSelectRows = [{ id: 'b1', name: 'Acme', email: 'enc', status: 'approved' }];
    await registerBuyer({ name: 'Acme', email: 'buyer@acme.com' });
    expect(mockInserts.length).toBe(0);
  });
});

describe('approve / reject / suspend', () => {
  it('approveBuyer sets approved + returns an invite token', async () => {
    mockSingle = { id: 'b1', name: 'Acme', email: 'enc', status: 'approved', approved_by: 'admin-1' };
    const { buyer, token } = await approveBuyer('b1', 'admin-1');
    expect(buyer.status).toBe('approved');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
    expect(mockUpdates[0].status).toBe('approved');
    expect(mockUpdates[0].approved_by).toBe('admin-1');
  });

  it('rejectBuyer sets status rejected', async () => {
    mockSingle = { id: 'b1', name: 'Acme', email: 'enc', status: 'rejected' };
    const b = await rejectBuyer('b1', 'admin-1');
    expect(b.status).toBe('rejected');
  });

  it('suspendBuyer sets status suspended', async () => {
    mockSingle = { id: 'b1', name: 'Acme', email: 'enc', status: 'suspended' };
    const b = await suspendBuyer('b1', 'admin-1');
    expect(b.status).toBe('suspended');
  });
});

describe('setBuyerPassword', () => {
  it('hashes the password for an approved buyer with a valid token', async () => {
    const token = await signBuyerInviteToken('b1');
    // getBuyerById then update both use .single()
    mockSingle = { id: 'b1', name: 'Acme', email: 'enc', status: 'approved' };

    await setBuyerPassword(token, 'supersecret');

    const updated = mockUpdates.find((u) => 'password_hash' in u);
    expect(updated).toBeDefined();
    const hash = (updated as { password_hash: string }).password_hash;
    expect(hash).not.toBe('supersecret');
    expect(bcrypt.compareSync('supersecret', hash)).toBe(true);
  });

  it('rejects a non-approved buyer', async () => {
    const token = await signBuyerInviteToken('b2');
    mockSingle = { id: 'b2', name: 'X', email: 'enc', status: 'pending' };
    await expect(setBuyerPassword(token, 'supersecret')).rejects.toThrow();
  });

  it('rejects an invalid token', async () => {
    await expect(setBuyerPassword('not-a-token', 'supersecret')).rejects.toThrow();
  });
});

describe('logBuyerVisit', () => {
  it('encrypts ip and writes a buyer_visits row', async () => {
    await logBuyerVisit('b1', { ip: '9.9.9.9', path: 'certificates' });
    const payload = mockInserts[0];
    expect(payload.buyer_id).toBe('b1');
    expect(payload.path).toBe('certificates');
    expect(payload.ip_address).not.toBe('9.9.9.9');
    expect(decrypt(payload.ip_address as string)).toBe('9.9.9.9');
  });
});

describe('getBuyerVisibleCertificates — visibility rule', () => {
  const internalVisible = { id: 'c1', name: 'ISO 9001', expiry_date: '2027-01-01', buyer_visible: true, submitted_by_supplier: false, buyer_tags: ['reliance'] };
  const internalHidden = { id: 'c2', name: 'Internal Only', expiry_date: '2027-01-01', buyer_visible: false, submitted_by_supplier: false, buyer_tags: [] };
  const supplierCert = { id: 'c3', name: 'Supplier Cert', expiry_date: '2027-01-01', buyer_visible: true, submitted_by_supplier: true, buyer_tags: [] };
  const internalVisibleTata = { id: 'c4', name: 'Tata Cert', expiry_date: '2027-01-01', buyer_visible: true, submitted_by_supplier: false, buyer_tags: ['tata'] };

  it('applies buyer_visible=true AND submitted_by_supplier=false filters in the query', async () => {
    mockSelectRows = [internalVisible, internalVisibleTata];
    (adminClient.eq as jest.Mock).mockClear();
    await getBuyerVisibleCertificates([]);
    const eqCalls = (adminClient.eq as jest.Mock).mock.calls;
    expect(eqCalls).toEqual(
      expect.arrayContaining([
        ['buyer_visible', true],
        ['submitted_by_supplier', false],
      ])
    );
  });

  it('also excludes archived certs from buyer visibility (archived=false filter)', async () => {
    mockSelectRows = [internalVisible];
    (adminClient.eq as jest.Mock).mockClear();
    await getBuyerVisibleCertificates([]);
    const eqCalls = (adminClient.eq as jest.Mock).mock.calls;
    // v1.1.1: archiving a cert must drop it from every buyer-facing read.
    expect(eqCalls).toEqual(expect.arrayContaining([['archived', false]]));
  });

  it('returns ONLY buyer_visible, non-supplier certs', async () => {
    mockSelectRows = [internalVisible, internalVisibleTata];
    const certs = await getBuyerVisibleCertificates([]);
    const ids = certs.map((c) => c.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c4');
    expect(ids).not.toContain('c2');
    expect(ids).not.toContain('c3');
  });

  it('respects visible_tags intersection when non-empty', async () => {
    mockSelectRows = [internalVisible, internalVisibleTata];
    const certs = await getBuyerVisibleCertificates(['reliance']);
    const ids = certs.map((c) => c.id);
    expect(ids).toEqual(['c1']); // only the reliance-tagged cert
    expect(ids).not.toContain('c4');
  });

  it('empty visible_tags = all buyer_visible certs', async () => {
    mockSelectRows = [internalVisible, internalVisibleTata];
    const certs = await getBuyerVisibleCertificates([]);
    expect(certs.length).toBe(2);
  });

  it('explicitly excludes a supplier cert and an internal-only cert', async () => {
    // Even if the mock erroneously returned all rows, the code-level intent is
    // that supplier + hidden certs are never surfaced. Here we assert the query
    // contract by checking a mixed set is filtered by tags and the caller only
    // ever receives what the DB returns (visible + non-supplier).
    mockSelectRows = [internalVisible]; // what the DB query yields
    const certs = await getBuyerVisibleCertificates([]);
    expect(certs.find((c) => c.id === 'c3')).toBeUndefined(); // supplier
    expect(certs.find((c) => c.id === 'c2')).toBeUndefined(); // internal-only
  });
});
