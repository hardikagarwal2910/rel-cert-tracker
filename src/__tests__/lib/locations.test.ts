/**
 * v1.1.3 — locations data layer: nickname persistence + full-field reads.
 */

let mockSelectRows: Array<Record<string, unknown>> = [];
let mockSingle: Record<string, unknown> | null = null;
let inserts: Array<Record<string, unknown>> = [];
let updates: Array<Record<string, unknown>> = [];

jest.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'neq', 'order', 'contains', 'in', 'gte', 'lte', 'not']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.insert = jest.fn((p: Record<string, unknown>) => { inserts.push(p); return chain; });
  chain.update = jest.fn((p: Record<string, unknown>) => { updates.push(p); return chain; });
  chain.single = jest.fn(() =>
    Promise.resolve({ data: mockSingle, error: mockSingle ? null : { message: 'no rows' } })
  );
  (chain as { then: unknown }).then = (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: mockSelectRows, error: null }).then(onFulfilled);
  return { adminClient: chain };
});

import { createLocation, updateLocation, getLocations, getLocationById } from '@/lib/db/locations';

beforeEach(() => {
  mockSelectRows = [];
  mockSingle = null;
  inserts = [];
  updates = [];
});

describe('createLocation', () => {
  it('persists the nickname alongside address fields', async () => {
    mockSingle = { id: 'l1', nickname: 'Shilaj Unit', name: 'Raghuvir Exim Limited', city: 'Ahmedabad' };
    await createLocation({
      nickname: 'Shilaj Unit',
      name: 'Raghuvir Exim Limited',
      address_line_1: 'Plot 42',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380058',
    });
    expect(inserts[0].nickname).toBe('Shilaj Unit');
    expect(inserts[0].name).toBe('Raghuvir Exim Limited');
    expect(inserts[0].country).toBe('India'); // default applied
  });
});

describe('updateLocation', () => {
  it('persists an edited nickname', async () => {
    mockSingle = { id: 'l1', nickname: 'Towel Plant', name: 'Raghuvir Exim Limited', city: 'Surat' };
    await updateLocation('l1', { nickname: 'Towel Plant', city: 'Surat' });
    expect(updates[0].nickname).toBe('Towel Plant');
    expect(updates[0].city).toBe('Surat');
    expect(typeof updates[0].updated_at).toBe('string');
  });
});

describe('getLocations', () => {
  it('returns nickname + all address fields for every row', async () => {
    mockSelectRows = [
      { id: 'l1', nickname: 'Shilaj Unit', name: 'Raghuvir Exim Limited', address_line_1: 'Plot 42', address_line_2: 'Phase II', city: 'Ahmedabad', state: 'Gujarat', pincode: '380058', country: 'India', active: true },
      { id: 'l2', nickname: null, name: 'Raghuvir Exim Limited', address_line_1: 'Unit 9', city: 'Surat', state: 'Gujarat', pincode: '395003', country: 'India', active: true },
    ];
    const rows = await getLocations();
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r).toHaveProperty('nickname');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('address_line_1');
      expect(r).toHaveProperty('city');
      expect(r).toHaveProperty('state');
      expect(r).toHaveProperty('pincode');
      expect(r).toHaveProperty('country');
      expect(r).toHaveProperty('active');
    }
    expect(rows[0].nickname).toBe('Shilaj Unit');
  });
});

describe('getLocationById', () => {
  it('returns the full single record including nickname', async () => {
    mockSingle = { id: 'l1', nickname: 'Head Office', name: 'Raghuvir Exim Limited', address_line_1: 'Plot 42', city: 'Ahmedabad', state: 'Gujarat', pincode: '380058', country: 'India', active: true };
    const loc = await getLocationById('l1');
    expect(loc?.nickname).toBe('Head Office');
    expect(loc?.address_line_1).toBe('Plot 42');
  });
});
