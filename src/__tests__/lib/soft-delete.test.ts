/**
 * v1.1.1 soft-delete / archive — data layer.
 *
 * Covers: certificate archive/unarchive + default exclusion, supplier
 * archive/reactivate + default exclusion of inactive, location deactivate
 * (keeps cert references intact) / reactivate + active filter, and category
 * deactivate + active filter.
 */

// ── Mutable Supabase mock state ───────────────────────────────────────────────
let mockSelectRows: Array<Record<string, unknown>> = [];
let mockSingle: Record<string, unknown> | null = null;
let updates: Array<Record<string, unknown>> = [];
let fromCalls: string[] = [];
let eqCalls: unknown[][] = [];
let neqCalls: unknown[][] = [];
let deleteCalled = false;

jest.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'contains', 'in', 'gte', 'lte']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.from = jest.fn((t: string) => { fromCalls.push(t); return chain; });
  chain.eq = jest.fn((...args: unknown[]) => { eqCalls.push(args); return chain; });
  chain.neq = jest.fn((...args: unknown[]) => { neqCalls.push(args); return chain; });
  chain.insert = jest.fn(() => chain);
  chain.update = jest.fn((payload: Record<string, unknown>) => { updates.push(payload); return chain; });
  chain.delete = jest.fn(() => { deleteCalled = true; return chain; });
  chain.single = jest.fn(() =>
    Promise.resolve({ data: mockSingle, error: mockSingle ? null : { message: 'no rows' } })
  );
  (chain as { then: unknown }).then = (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: mockSelectRows, error: null }).then(onFulfilled);
  return { adminClient: chain };
});

import {
  getCertificates,
  archiveCertificate,
  unarchiveCertificate,
  getExpiringSoon,
} from '@/lib/db/certificates';
import {
  getSuppliers,
  archiveSupplier,
  reactivateSupplier,
} from '@/lib/db/suppliers';
import {
  getLocations,
  deactivateLocation,
  reactivateLocation,
} from '@/lib/db/locations';
import { getCategories, deactivateCategory } from '@/lib/db/categories';

beforeEach(() => {
  mockSelectRows = [];
  mockSingle = null;
  updates = [];
  fromCalls = [];
  eqCalls = [];
  neqCalls = [];
  deleteCalled = false;
});

const hasCall = (calls: unknown[][], col: string, val: unknown) =>
  calls.some((c) => c[0] === col && c[1] === val);

// ── Certificates ──────────────────────────────────────────────────────────────
describe('archiveCertificate', () => {
  it('sets archived=true, records who/when, and forces buyer_visible=false', async () => {
    mockSingle = { id: 'c1', name: 'ISO 9001', expiry_date: '2027-01-01' };
    const cert = await archiveCertificate('c1', 'user-1');

    const u = updates[0];
    expect(u.archived).toBe(true);
    expect(u.buyer_visible).toBe(false); // critical: drops out of buyer views
    expect(u.archived_by).toBe('user-1');
    expect(typeof u.archived_at).toBe('string');
    expect(cert.id).toBe('c1');
  });
});

describe('unarchiveCertificate', () => {
  it('clears archived flags (restores to active list)', async () => {
    mockSingle = { id: 'c1', name: 'ISO 9001', expiry_date: '2027-01-01' };
    await unarchiveCertificate('c1');

    const u = updates[0];
    expect(u.archived).toBe(false);
    expect(u.archived_at).toBeNull();
    expect(u.archived_by).toBeNull();
    expect('buyer_visible' in u).toBe(false); // left OFF — admin re-enables manually
  });
});

describe('getCertificates archive filtering', () => {
  it('excludes archived by default (archived=false)', async () => {
    await getCertificates();
    expect(hasCall(eqCalls, 'archived', false)).toBe(true);
    expect(hasCall(eqCalls, 'archived', true)).toBe(false);
  });

  it('archived:true returns ONLY archived', async () => {
    await getCertificates({ archived: true });
    expect(hasCall(eqCalls, 'archived', true)).toBe(true);
    expect(hasCall(eqCalls, 'archived', false)).toBe(false);
  });

  it('includeArchived:true applies no archived constraint', async () => {
    await getCertificates({ includeArchived: true });
    expect(eqCalls.some((c) => c[0] === 'archived')).toBe(false);
  });
});

describe('getExpiringSoon', () => {
  it('excludes archived certs from expiry notifications', async () => {
    await getExpiringSoon(30);
    expect(hasCall(eqCalls, 'archived', false)).toBe(true);
  });
});

// ── Suppliers ─────────────────────────────────────────────────────────────────
describe('archiveSupplier', () => {
  it('sets status=inactive (soft delete, no hard delete)', async () => {
    mockSingle = { id: 's1', name: 'Acme Mills', status: 'inactive', contacts: [] };
    const s = await archiveSupplier('s1');
    expect(updates[0].status).toBe('inactive');
    expect(deleteCalled).toBe(false);
    expect(s.status).toBe('inactive');
  });
});

describe('reactivateSupplier', () => {
  it('restores to active when onboarding checklist is complete', async () => {
    mockSingle = {
      id: 's1', name: 'Acme', status: 'active', contacts: [],
      onboarding_checklist: {
        contacts_added: true, required_certs_defined: true, invite_sent: true,
        invite_accepted: true, first_cert_uploaded: true,
      },
    };
    await reactivateSupplier('s1');
    expect(updates[updates.length - 1].status).toBe('active');
  });

  it('restores to onboarding when checklist is incomplete', async () => {
    mockSingle = {
      id: 's2', name: 'Beta', status: 'onboarding', contacts: [],
      onboarding_checklist: {
        contacts_added: true, required_certs_defined: false, invite_sent: false,
        invite_accepted: false, first_cert_uploaded: false,
      },
    };
    await reactivateSupplier('s2');
    expect(updates[updates.length - 1].status).toBe('onboarding');
  });
});

describe('getSuppliers default exclusion', () => {
  it('excludes status=inactive by default', async () => {
    await getSuppliers();
    expect(hasCall(neqCalls, 'status', 'inactive')).toBe(true);
  });

  it('includeInactive:true returns everyone (no neq filter)', async () => {
    await getSuppliers({ includeInactive: true });
    expect(neqCalls.length).toBe(0);
  });

  it('an explicit status filter takes precedence', async () => {
    await getSuppliers({ status: 'inactive' });
    expect(hasCall(eqCalls, 'status', 'inactive')).toBe(true);
    expect(neqCalls.length).toBe(0);
  });
});

// ── Locations ─────────────────────────────────────────────────────────────────
describe('deactivateLocation', () => {
  it('only flips active=false and never touches the certificates table', async () => {
    await deactivateLocation('l1');
    expect(updates[0].active).toBe(false);
    expect(deleteCalled).toBe(false);
    // Existing cert references stay intact — we only update the locations row.
    expect(fromCalls).toEqual(['locations']);
    expect(fromCalls).not.toContain('certificates');
  });
});

describe('reactivateLocation', () => {
  it('flips active=true', async () => {
    await reactivateLocation('l1');
    expect(updates[0].active).toBe(true);
  });
});

describe('getLocations active filter', () => {
  it('activeOnly=true filters active=true', async () => {
    await getLocations(true);
    expect(hasCall(eqCalls, 'active', true)).toBe(true);
  });

  it('default returns all (no active filter)', async () => {
    await getLocations();
    expect(eqCalls.some((c) => c[0] === 'active')).toBe(false);
  });
});

// ── Categories ────────────────────────────────────────────────────────────────
describe('deactivateCategory', () => {
  it('flips active=false on the categories table', async () => {
    await deactivateCategory('cat1');
    expect(updates[0].active).toBe(false);
    expect(fromCalls).toEqual(['categories']);
  });
});

describe('getCategories active filter', () => {
  it('activeOnly=true removes deactivated categories from the active list', async () => {
    await getCategories(true);
    expect(hasCall(eqCalls, 'active', true)).toBe(true);
  });
});
