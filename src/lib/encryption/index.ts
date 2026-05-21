import CryptoJS from 'crypto-js';

function getKey(): string {
  const key = process.env.ENCRYPTION_KEY ?? '';
  if (key.length < 32) {
    throw new Error(
      'FATAL: ENCRYPTION_KEY must be at least 32 characters. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  return key;
}

/**
 * encrypt — AES-256 encrypt a string.
 * Uses a random IV each call (non-deterministic ciphertext).
 * Returns a base64 string: "<iv-hex>:<ciphertext-base64>"
 */
export function encrypt(value: string): string {
  const KEY = getKey();
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.enc.Utf8.parse(KEY.substring(0, 32));
  const encrypted = CryptoJS.AES.encrypt(value, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
}

/**
 * decrypt — AES-256 decrypt a string produced by encrypt().
 * Returns null on any decryption error (invalid ciphertext, wrong key).
 */
export function decrypt(ciphertext: string): string | null {
  try {
    const KEY = getKey();
    const [ivHex, ct] = ciphertext.split(':');
    if (!ivHex || !ct) return null;
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const key = CryptoJS.enc.Utf8.parse(KEY.substring(0, 32));
    const decrypted = CryptoJS.AES.decrypt(ct, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) return null;
    return result;
  } catch {
    return null;
  }
}
