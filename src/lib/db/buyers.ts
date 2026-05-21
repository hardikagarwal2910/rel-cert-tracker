import { adminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/encryption';
import type { Buyer } from '@/types/database';
import type { BuyerInput } from '@/types';

function encryptBuyer(
  input: BuyerInput
): Omit<BuyerInput, 'email' | 'ip_address'> & { email: string; ip_address?: string } {
  return {
    ...input,
    email: encrypt(input.email),
    ip_address: input.ip_address ? encrypt(input.ip_address) : undefined,
  };
}

function decryptBuyer(raw: Buyer): Buyer {
  return {
    ...raw,
    email: decrypt(raw.email) ?? raw.email,
    ip_address: raw.ip_address ? (decrypt(raw.ip_address) ?? raw.ip_address) : raw.ip_address,
  };
}

export async function createBuyer(input: BuyerInput): Promise<Buyer> {
  const encrypted = encryptBuyer(input);
  const { data, error } = await adminClient
    .from('buyers')
    .insert(encrypted)
    .select()
    .single();
  if (error) throw error;
  return decryptBuyer(data as Buyer);
}

export async function getBuyerByEmail(email: string): Promise<Buyer | null> {
  // Encrypted emails are non-deterministic — must fetch all and compare decrypted
  const { data, error } = await adminClient.from('buyers').select('*');
  if (error) throw error;
  const buyers = (data as Buyer[]) ?? [];
  const found = buyers.find((b) => {
    const decrypted = decrypt(b.email);
    return decrypted === email;
  });
  return found ? decryptBuyer(found) : null;
}

export async function getBuyers(): Promise<Buyer[]> {
  const { data, error } = await adminClient
    .from('buyers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as Buyer[]) ?? []).map(decryptBuyer);
}

export async function logBuyerVisit(buyerId: string, ip: string): Promise<void> {
  const { error } = await adminClient
    .from('buyers')
    .update({
      ip_address: encrypt(ip),
      updated_at: new Date().toISOString(),
    })
    .eq('id', buyerId);
  if (error) throw error;
}
