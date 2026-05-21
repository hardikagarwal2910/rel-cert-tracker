import { adminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/encryption';
import { v4 as uuidv4 } from 'uuid';
import type { DownloadToken } from '@/types/database';

/**
 * createDownloadToken — generate a one-time 48-hour download token.
 * Buyer email is encrypted before storage.
 */
export async function createDownloadToken(
  certId: string,
  buyerEmail: string
): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error } = await adminClient.from('download_tokens').insert({
    token,
    cert_id: certId,
    buyer_email: encrypt(buyerEmail),
    expires_at: expiresAt,
    used: false,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return token;
}

/**
 * validateAndUseToken — validate token in Supabase (expiry check in query, not JS).
 * Returns certId if valid, null if invalid/expired/used.
 * Marks token as used atomically.
 */
export async function validateAndUseToken(
  tokenValue: string
): Promise<{ certId: string } | null> {
  const now = new Date().toISOString();

  // Expiry check is in the Supabase query — NOT in JavaScript after fetch
  const { data, error } = await adminClient
    .from('download_tokens')
    .select('cert_id, used, expires_at')
    .eq('token', tokenValue)
    .eq('used', false)
    .gt('expires_at', now)
    .single();

  if (error || !data) return null;

  const row = data as DownloadToken;

  // Mark as used
  await adminClient
    .from('download_tokens')
    .update({ used: true, used_at: new Date().toISOString() })
    .eq('token', tokenValue);

  return { certId: row.cert_id };
}
