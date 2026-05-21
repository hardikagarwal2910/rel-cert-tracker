/**
 * Tests for AES-256 encryption/decryption in src/lib/encryption/index.ts
 * ENCRYPTION_KEY is set to a 36-char string in setup.ts.
 */

import { encrypt, decrypt } from '@/lib/encryption';

describe('Encryption', () => {
  it('encrypt returns a string different from input', () => {
    const result = encrypt('test@example.com');
    expect(result).not.toBe('test@example.com');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('encrypt result contains IV separator colon', () => {
    const result = encrypt('hello');
    expect(result).toContain(':');
  });

  it('decrypt reverses encrypt correctly', () => {
    const original = 'hardik.agarwal@raghuvirexim.com';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('encrypt is non-deterministic (same input → different ciphertext)', () => {
    const e1 = encrypt('test@example.com');
    const e2 = encrypt('test@example.com');
    // Different ciphertext (random IV)
    expect(e1).not.toBe(e2);
    // But both decrypt to same value
    expect(decrypt(e1)).toBe('test@example.com');
    expect(decrypt(e2)).toBe('test@example.com');
  });

  it('decrypt of invalid ciphertext returns null gracefully', () => {
    expect(() => decrypt('notvalidciphertext')).not.toThrow();
    expect(decrypt('notvalidciphertext')).toBeNull();
  });

  it('decrypt of empty string returns null', () => {
    expect(decrypt('')).toBeNull();
  });

  it('decrypt of malformed IV:ciphertext returns null', () => {
    expect(decrypt('badivsection:badciphertext')).toBeNull();
  });

  it('ENCRYPTION_KEY under 32 chars throws when encrypt is called', () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'short';
    // Jest module cache must be cleared for the lazy getter to re-check env
    jest.resetModules();
    const { encrypt: freshEncrypt } = require('@/lib/encryption');
    expect(() => freshEncrypt('test')).toThrow('ENCRYPTION_KEY');
    // Restore
    process.env.ENCRYPTION_KEY = originalKey;
    jest.resetModules();
  });
});
