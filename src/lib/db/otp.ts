import { adminClient } from '@/lib/supabase/admin';
import bcrypt from 'bcryptjs';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/**
 * Generate a 6-digit numeric OTP, store it HASHED with a 10-minute expiry,
 * invalidate any prior unused codes for the user, and return the PLAIN code
 * (for emailing only — never persisted in plaintext).
 */
export async function createOtp(userId: string): Promise<string> {
  // Invalidate prior unused codes for this user.
  await adminClient
    .from('otp_codes')
    .update({ used: true })
    .eq('user_id', userId)
    .eq('used', false);

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 100000–999999
  const code_hash = await bcrypt.hash(code, 10);
  const expires_at = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error } = await adminClient
    .from('otp_codes')
    .insert({ user_id: userId, code_hash, expires_at });
  if (error) throw error;

  return code;
}

export interface VerifyOtpResult {
  ok: boolean;
  remaining?: number;
}

/**
 * Verify a submitted OTP. Fetches the latest unused, unexpired code for the
 * user (expiry enforced in the query). Increments attempts; after MAX_ATTEMPTS
 * the code is invalidated. Single-use on success.
 */
export async function verifyOtp(userId: string, code: string): Promise<VerifyOtpResult> {
  const now = new Date().toISOString();

  const { data, error } = await adminClient
    .from('otp_codes')
    .select('*')
    .eq('user_id', userId)
    .eq('used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return { ok: false };

  const otp = data as { id: string; code_hash: string; attempts: number };
  const attempts = otp.attempts + 1;

  // Too many attempts → invalidate and fail.
  if (attempts > MAX_ATTEMPTS) {
    await adminClient.from('otp_codes').update({ used: true, attempts }).eq('id', otp.id);
    return { ok: false, remaining: 0 };
  }

  const match = await bcrypt.compare(code, otp.code_hash);
  if (match) {
    await adminClient.from('otp_codes').update({ used: true, attempts }).eq('id', otp.id);
    return { ok: true };
  }

  await adminClient.from('otp_codes').update({ attempts }).eq('id', otp.id);
  return { ok: false, remaining: Math.max(0, MAX_ATTEMPTS - attempts) };
}
