import { adminClient } from '@/lib/supabase/admin';
import type { Certificate } from '@/types/database';
import type { CertFilter, CertInput, RenewalInput } from '@/types';

function computeStatus(expiryDate: string): 'active' | 'expiring_soon' | 'expired' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring_soon';
  return 'active';
}

export async function getCertificates(filters?: CertFilter): Promise<Certificate[]> {
  let query = adminClient.from('certificates').select('*');

  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.location_id) query = query.eq('location_id', filters.location_id);
  if (filters?.buyer_visible !== undefined) query = query.eq('buyer_visible', filters.buyer_visible);
  if (filters?.view === 'internal') query = query.eq('submitted_by_supplier', false);
  if (filters?.view === 'supplier') query = query.eq('submitted_by_supplier', true);
  if (filters?.buyer_tag) query = query.contains('buyer_tags', JSON.stringify([filters.buyer_tag]));

  query = query.order('expiry_date', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  return ((data as Certificate[]) ?? []).map((cert) => ({
    ...cert,
    status: computeStatus(cert.expiry_date),
  }));
}

export async function getCertificateById(id: string): Promise<Certificate | null> {
  const { data, error } = await adminClient
    .from('certificates')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  const cert = data as Certificate;
  return { ...cert, status: computeStatus(cert.expiry_date) };
}

/**
 * The ONLY function the buyer portal uses to read certificates.
 * Hard rule: buyers see exclusively REL-internal certs that are explicitly
 * marked buyer_visible. Supplier-submitted certs are NEVER returned here.
 * If the buyer has visible_tags set (non-empty), the result is further
 * restricted to certs whose buyer_tags intersect those tags. An empty
 * visibleTags array means "all buyer_visible certs".
 */
export async function getBuyerVisibleCertificates(
  visibleTags: string[] = []
): Promise<Certificate[]> {
  const { data, error } = await adminClient
    .from('certificates')
    .select('*')
    .eq('buyer_visible', true)
    .eq('submitted_by_supplier', false)
    .order('expiry_date', { ascending: true });
  if (error) throw error;

  let certs = ((data as Certificate[]) ?? []).map((cert) => ({
    ...cert,
    status: computeStatus(cert.expiry_date),
  }));

  // Tag-based restriction (intersection), applied in code so the rule is
  // explicit and testable. Empty visibleTags = no restriction.
  if (visibleTags.length > 0) {
    const allowed = new Set(visibleTags);
    certs = certs.filter((c) => (c.buyer_tags ?? []).some((t) => allowed.has(t)));
  }

  return certs;
}

export async function createCertificate(input: CertInput): Promise<Certificate> {
  const { data, error } = await adminClient
    .from('certificates')
    .insert({
      ...input,
      status: computeStatus(input.expiry_date),
      buyer_tags: input.buyer_tags ?? [],
      version_history: [],
      notification_log: [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as Certificate;
}

export async function updateCertificate(
  id: string,
  input: Partial<CertInput>
): Promise<Certificate> {
  const update: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  if (input.expiry_date) {
    update.status = computeStatus(input.expiry_date);
  }
  const { data, error } = await adminClient
    .from('certificates')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Certificate;
}

export async function renewCertificate(
  id: string,
  renewalData: RenewalInput
): Promise<Certificate> {
  // Fetch current cert to snapshot into version_history
  const current = await getCertificateById(id);
  if (!current) throw new Error(`Certificate ${id} not found`);

  const historyEntry = {
    version: (current.version_history?.length ?? 0) + 1,
    updated_at: new Date().toISOString(),
    updated_by: renewalData.updated_by,
    expiry_date: current.expiry_date,
    cert_number: current.cert_number,
    notes: current.notes,
  };

  const newHistory = [...(current.version_history ?? []), historyEntry];

  const { data, error } = await adminClient
    .from('certificates')
    .update({
      expiry_date: renewalData.new_expiry_date,
      ...(renewalData.new_cert_number && { cert_number: renewalData.new_cert_number }),
      ...(renewalData.renewal_cost !== undefined && { renewal_cost: renewalData.renewal_cost }),
      ...(renewalData.notes && { notes: renewalData.notes }),
      status: computeStatus(renewalData.new_expiry_date),
      renewal_stage: 'not_started',  // reset the renewal workflow for the new period
      version_history: newHistory,
      notification_log: [],  // reset notification log for new expiry period
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Certificate;
}

export async function deleteCertificate(id: string): Promise<void> {
  const { error } = await adminClient.from('certificates').delete().eq('id', id);
  if (error) throw error;
}

export async function getExpiringSoon(days: number): Promise<Certificate[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = new Date(today);
  future.setDate(future.getDate() + days);

  const { data, error } = await adminClient
    .from('certificates')
    .select('*')
    .gte('expiry_date', today.toISOString().split('T')[0])
    .lte('expiry_date', future.toISOString().split('T')[0])
    .order('expiry_date', { ascending: true });

  if (error) throw error;
  return ((data as Certificate[]) ?? []).map((cert) => ({
    ...cert,
    status: computeStatus(cert.expiry_date),
  }));
}
