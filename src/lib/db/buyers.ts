import { createHash } from 'crypto';
import { adminClient } from '@/lib/supabase/admin';
import bcrypt from 'bcryptjs';
import { encrypt, decrypt } from '@/lib/encryption';
import { signBuyerInviteToken, verifyBuyerInviteToken } from '@/lib/auth/buyer-token';
import type { Buyer, BuyerVisit, BuyerStatus } from '@/types/database';

// Deterministic hash for duplicate detection / lookup (email itself is
// AES-encrypted and non-deterministic, so cannot be queried directly).
function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function decryptBuyer(raw: Buyer): Buyer {
  return {
    ...raw,
    email: decrypt(raw.email) ?? raw.email,
    ip_address: raw.ip_address ? (decrypt(raw.ip_address) ?? raw.ip_address) : raw.ip_address,
  };
}

export interface RegisterBuyerInput {
  name: string;
  company?: string;
  email: string;
  designation?: string;
  ip_address?: string;
  geolocation?: Record<string, unknown> | null;
}

/**
 * Self-registration. Encrypts email + ip, defaults status to 'pending'.
 * If a pending/approved buyer with the same email already exists, returns it
 * (idempotent) so the caller can show a generic success without leaking
 * whether the account existed.
 */
export async function registerBuyer(input: RegisterBuyerInput): Promise<Buyer> {
  const hash = emailHash(input.email);

  const { data: existingRows } = await adminClient
    .from('buyers')
    .select('*')
    .eq('email_hash', hash);
  const existing = ((existingRows as Buyer[]) ?? []).find(
    (b) => b.status === 'pending' || b.status === 'approved'
  );
  if (existing) return decryptBuyer(existing);

  const { data, error } = await adminClient
    .from('buyers')
    .insert({
      name: input.name,
      company: input.company,
      email: encrypt(input.email),
      email_hash: hash,
      designation: input.designation,
      ip_address: input.ip_address ? encrypt(input.ip_address) : null,
      geolocation: input.geolocation ?? null,
      status: 'pending',
      visible_tags: [],
    })
    .select()
    .single();
  if (error) throw error;
  return decryptBuyer(data as Buyer);
}

export async function getBuyers(statusFilter?: BuyerStatus): Promise<Buyer[]> {
  let query = adminClient.from('buyers').select('*').order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw error;
  return ((data as Buyer[]) ?? []).map(decryptBuyer);
}

export async function getBuyerById(id: string): Promise<Buyer | null> {
  const { data, error } = await adminClient.from('buyers').select('*').eq('id', id).single();
  if (error || !data) return null;
  return decryptBuyer(data as Buyer);
}

export async function getBuyerByEmail(email: string): Promise<Buyer | null> {
  const { data, error } = await adminClient
    .from('buyers')
    .select('*')
    .eq('email_hash', emailHash(email))
    .limit(1)
    .single();
  if (error || !data) return null;
  return decryptBuyer(data as Buyer);
}

async function setStatus(id: string, status: BuyerStatus, extra: Record<string, unknown> = {}): Promise<Buyer> {
  const { data, error } = await adminClient
    .from('buyers')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return decryptBuyer(data as Buyer);
}

/**
 * Approve a buyer and issue a 7-day signed set-password token (stateless JWT).
 */
export async function approveBuyer(
  id: string,
  adminUserId: string
): Promise<{ buyer: Buyer; token: string }> {
  const buyer = await setStatus(id, 'approved', {
    approved_by: adminUserId,
    approved_at: new Date().toISOString(),
  });
  const token = await signBuyerInviteToken(id);
  return { buyer, token };
}

export async function rejectBuyer(id: string, adminUserId: string): Promise<Buyer> {
  return setStatus(id, 'rejected', { approved_by: adminUserId });
}

export async function suspendBuyer(id: string, adminUserId: string): Promise<Buyer> {
  return setStatus(id, 'suspended', { approved_by: adminUserId });
}

export async function setBuyerVisibleTags(id: string, tags: string[]): Promise<Buyer> {
  const { data, error } = await adminClient
    .from('buyers')
    .update({ visible_tags: tags, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return decryptBuyer(data as Buyer);
}

/**
 * Set a buyer's password via a valid invite token. Only approved buyers.
 */
export async function setBuyerPassword(token: string, password: string): Promise<Buyer> {
  const buyerId = await verifyBuyerInviteToken(token);
  if (!buyerId) throw new Error('Invalid or expired token');

  const buyer = await getBuyerById(buyerId);
  if (!buyer) throw new Error('Buyer not found');
  if (buyer.status !== 'approved') throw new Error('Buyer is not approved');

  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await adminClient
    .from('buyers')
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq('id', buyerId)
    .select()
    .single();
  if (error) throw error;
  return decryptBuyer(data as Buyer);
}

export async function updateBuyerLogin(id: string): Promise<void> {
  await adminClient
    .from('buyers')
    .update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
}

export interface VisitInput {
  ip?: string;
  geolocation?: Record<string, unknown> | null;
  path?: string;
  userAgent?: string;
}

/**
 * Record a buyer visit (encrypts ip). Fire-and-forget — never throws to the
 * caller so it cannot block a response.
 */
export async function logBuyerVisit(buyerId: string, visit: VisitInput): Promise<void> {
  try {
    await adminClient.from('buyer_visits').insert({
      buyer_id: buyerId,
      ip_address: visit.ip ? encrypt(visit.ip) : null,
      geolocation: visit.geolocation ?? null,
      path: visit.path ?? null,
      user_agent: visit.userAgent ?? null,
    });
  } catch {
    // best-effort — visit logging must never break the request
  }
}

export async function getBuyerVisits(buyerId?: string, limit = 100): Promise<BuyerVisit[]> {
  let query = adminClient
    .from('buyer_visits')
    .select('*')
    .order('visited_at', { ascending: false })
    .limit(limit);
  if (buyerId) query = query.eq('buyer_id', buyerId);
  const { data, error } = await query;
  if (error) throw error;
  return ((data as BuyerVisit[]) ?? []).map((v) => ({
    ...v,
    ip_address: v.ip_address ? (decrypt(v.ip_address) ?? v.ip_address) : v.ip_address,
  }));
}
