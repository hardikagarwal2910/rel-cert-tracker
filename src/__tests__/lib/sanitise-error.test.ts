/**
 * Tests for sanitiseError in src/lib/security/sanitise-error.ts
 */

import { sanitiseError } from '@/lib/security/sanitise-error';

describe('sanitiseError', () => {
  it('strips Anthropic API key from error string', () => {
    const err = new Error('Request failed with sk-ant-api03-abc123xyz');
    const result = sanitiseError(err);
    expect(result).not.toContain('sk-ant-');
    expect(result).not.toContain('abc123xyz');
    expect(typeof result).toBe('string');
  });

  it('strips private key from error string', () => {
    const err = new Error('Auth failed: -----BEGIN RSA PRIVATE KEY----- MIIEowIBAAKCAQ -----END RSA PRIVATE KEY-----');
    const result = sanitiseError(err);
    expect(result).not.toContain('-----BEGIN');
    expect(typeof result).toBe('string');
  });

  it('strips Resend key from error string', () => {
    const err = new Error('Invalid key: resend_live_abc123');
    const result = sanitiseError(err);
    expect(result).not.toContain('resend_');
    expect(typeof result).toBe('string');
  });

  it('strips JWT token from error string', () => {
    const err = new Error('Invalid token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    const result = sanitiseError(err);
    expect(result).not.toMatch(/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/);
  });

  it('returns safe string for normal errors', () => {
    const err = new Error('Database connection failed');
    const result = sanitiseError(err);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Database connection failed');
  });

  it('handles non-Error string safely', () => {
    expect(() => sanitiseError('string error')).not.toThrow();
    const result = sanitiseError('string error');
    expect(typeof result).toBe('string');
  });

  it('handles null safely', () => {
    expect(() => sanitiseError(null)).not.toThrow();
    const result = sanitiseError(null);
    expect(typeof result).toBe('string');
  });

  it('handles undefined safely', () => {
    expect(() => sanitiseError(undefined)).not.toThrow();
    const result = sanitiseError(undefined);
    expect(typeof result).toBe('string');
  });

  it('handles plain object safely', () => {
    expect(() => sanitiseError({ code: 'ECONNRESET' })).not.toThrow();
    const result = sanitiseError({ code: 'ECONNRESET' });
    expect(typeof result).toBe('string');
  });
});
