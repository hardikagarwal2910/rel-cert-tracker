/**
 * OTP data layer — codes are stored HASHED; verify enforces single-use,
 * wrong-code failure, attempt cap, and expiry/none handling.
 */

import bcrypt from 'bcryptjs';

let mockSingle: Record<string, unknown> | null = null;

jest.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'order', 'limit', 'update', 'insert']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.from = jest.fn(() => chain);
  chain.single = jest.fn(() =>
    Promise.resolve({ data: mockSingle, error: mockSingle ? null : { message: 'no rows' } })
  );
  (chain as { then: unknown }).then = (onFulfilled: (v: { error: null }) => unknown) =>
    Promise.resolve({ error: null }).then(onFulfilled);
  return { adminClient: chain };
});

import { createOtp, verifyOtp } from '@/lib/db/otp';
import { adminClient } from '@/lib/supabase/admin';

describe('createOtp', () => {
  it('returns a 6-digit code and stores it HASHED (never plain)', async () => {
    const insertSpy = (adminClient.insert as jest.Mock);
    insertSpy.mockClear();

    const code = await createOtp('user-1');
    expect(code).toMatch(/^\d{6}$/);

    const payload = insertSpy.mock.calls[0][0] as { code_hash: string };
    expect(payload.code_hash).not.toBe(code); // not plaintext
    expect(payload.code_hash.startsWith('$2')).toBe(true); // bcrypt hash
    // The hash verifies against the plain code
    expect(bcrypt.compareSync(code, payload.code_hash)).toBe(true);
  });
});

describe('verifyOtp', () => {
  it('succeeds on the correct code', async () => {
    mockSingle = { id: 'o1', code_hash: bcrypt.hashSync('123456', 10), attempts: 0 };
    const res = await verifyOtp('user-1', '123456');
    expect(res.ok).toBe(true);
  });

  it('fails on a wrong code and reports remaining attempts', async () => {
    mockSingle = { id: 'o1', code_hash: bcrypt.hashSync('123456', 10), attempts: 0 };
    const res = await verifyOtp('user-1', '000000');
    expect(res.ok).toBe(false);
    expect(res.remaining).toBe(4);
  });

  it('fails (locked) after the 5th attempt', async () => {
    mockSingle = { id: 'o1', code_hash: bcrypt.hashSync('123456', 10), attempts: 5 };
    const res = await verifyOtp('user-1', '123456');
    expect(res.ok).toBe(false);
    expect(res.remaining).toBe(0);
  });

  it('fails when no unexpired/unused code exists (expired or used)', async () => {
    mockSingle = null;
    const res = await verifyOtp('user-1', '123456');
    expect(res.ok).toBe(false);
  });
});
