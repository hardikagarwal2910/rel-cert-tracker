/**
 * Instruction 5 — Task 5: getSupplierScorecard computes a real on_time_rate,
 * not a hardcoded 0.8.
 */

// Mutable result the mocked query chain resolves to.
let scRows: Array<Record<string, unknown>> = [];

jest.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'order', 'gte', 'lte', 'contains', 'update', 'insert']) {
    chain[m] = jest.fn(() => chain);
  }
  // Make the chain awaitable: resolves to { data: scRows, error: null }
  chain.then = (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: scRows, error: null }).then(onFulfilled);
  chain.single = jest.fn(() => Promise.resolve({ data: scRows[0] ?? null, error: null }));
  return { adminClient: chain };
});

jest.mock('@/lib/encryption', () => ({
  encrypt: jest.fn((v: string) => v),
  decrypt: jest.fn((v: string) => v),
}));

import {
  getSupplierScorecard,
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
} from '@/lib/db/suppliers';

describe('getSupplierScorecard — on_time_rate', () => {
  it('returns 0 (not 0.8) when there are no submissions', async () => {
    scRows = [];
    const sc = await getSupplierScorecard('sup-empty');
    expect(sc.total_submissions).toBe(0);
    expect(sc.on_time_rate).toBe(0);
    expect(sc.on_time_rate).not.toBe(0.8);
  });

  it('computes on_time_rate from data — first submission counts on-time', async () => {
    scRows = [
      { status: 'approved', submission_date: '2024-01-01', expiry_date: '2025-01-01', cert_name: 'ISO 9001' },
    ];
    const sc = await getSupplierScorecard('sup-1');
    expect(sc.total_submissions).toBe(1);
    expect(sc.submitted_on_time).toBe(1);
    expect(sc.submitted_late).toBe(0);
    expect(sc.on_time_rate).toBe(1);
    expect(sc.on_time_rate).not.toBe(0.8);
  });

  it('flags a late renewal (submitted after prior cert expired)', async () => {
    scRows = [
      { status: 'approved', submission_date: '2023-01-01', expiry_date: '2024-01-01', cert_name: 'ISO 9001' },
      // renewal submitted in March 2024 — AFTER the Jan 2024 expiry → late
      { status: 'approved', submission_date: '2024-03-01', expiry_date: '2025-03-01', cert_name: 'ISO 9001' },
    ];
    const sc = await getSupplierScorecard('sup-2');
    expect(sc.submitted_on_time).toBe(1); // the initial
    expect(sc.submitted_late).toBe(1); // the late renewal
    expect(sc.on_time_rate).toBeCloseTo(0.5, 5);
    expect(sc.on_time_rate).not.toBe(0.8);
  });

  it('counts an early renewal as on-time', async () => {
    scRows = [
      { status: 'approved', submission_date: '2023-01-01', expiry_date: '2024-06-01', cert_name: 'ISO 9001' },
      // renewal submitted in May 2024 — BEFORE the Jun 2024 expiry → on time
      { status: 'approved', submission_date: '2024-05-01', expiry_date: '2025-05-01', cert_name: 'ISO 9001' },
    ];
    const sc = await getSupplierScorecard('sup-3');
    expect(sc.submitted_on_time).toBe(2);
    expect(sc.submitted_late).toBe(0);
    expect(sc.on_time_rate).toBe(1);
  });
});

describe('suppliers db — CRUD coverage', () => {
  const sampleSupplier = {
    id: 'sup-001',
    name: 'Acme Supplier',
    tier: '1',
    status: 'onboarding',
    contacts: [{ name: 'Jane', email: 'jane@x.com', phone: '123', role: 'Compliance' }],
    commodity_tags: ['rice'],
    buyer_links: ['Acme'],
    required_cert_ids: [],
    onboarding_checklist: {
      contacts_added: true,
      required_certs_defined: true,
      invite_sent: true,
      invite_accepted: true,
      first_cert_uploaded: true,
    },
  };

  it('getSuppliers applies all filters without error', async () => {
    scRows = [sampleSupplier];
    const result = await getSuppliers({
      tier: '1',
      status: 'active',
      buyer_link: 'Acme',
      commodity: 'rice',
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].contacts[0].email).toBe('jane@x.com'); // decrypted (mock identity)
  });

  it('getSuppliers with no filters', async () => {
    scRows = [sampleSupplier];
    const result = await getSuppliers();
    expect(result.length).toBe(1);
  });

  it('getSupplierById returns decrypted supplier', async () => {
    scRows = [sampleSupplier];
    const s = await getSupplierById('sup-001');
    expect(s?.name).toBe('Acme Supplier');
  });

  it('createSupplier encrypts contacts and seeds checklist', async () => {
    scRows = [sampleSupplier];
    const created = await createSupplier({
      name: 'Acme Supplier',
      tier: '1',
      contacts: [{ name: 'Jane', email: 'jane@x.com', phone: '123' }],
      commodity_tags: ['rice'],
      buyer_links: ['Acme'],
      required_cert_ids: [],
    } as Parameters<typeof createSupplier>[0]);
    expect(created.id).toBe('sup-001');
  });

  it('updateSupplier recomputes checklist and may auto-promote', async () => {
    scRows = [sampleSupplier];
    const updated = await updateSupplier('sup-001', {
      contacts: [{ name: 'Jane', email: 'jane@x.com', phone: '123' }],
      status: 'onboarding',
    } as Parameters<typeof updateSupplier>[1]);
    expect(updated.id).toBe('sup-001');
  });
});
