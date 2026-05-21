import { adminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/encryption';
import type { Supplier, SupplierContact, OnboardingChecklist, Scorecard } from '@/types/database';
import type { SupplierFilter, SupplierInput } from '@/types';

function encryptContacts(contacts: SupplierInput['contacts']): SupplierContact[] {
  if (!contacts) return [];
  return contacts.map((c) => ({
    ...c,
    email: c.email ? encrypt(c.email) : c.email,
    phone: c.phone ? encrypt(c.phone) : c.phone,
  }));
}

function decryptContacts(contacts: SupplierContact[]): SupplierContact[] {
  if (!contacts) return [];
  return contacts.map((c) => ({
    ...c,
    email: c.email ? (decrypt(c.email) ?? c.email) : c.email,
    phone: c.phone ? (decrypt(c.phone) ?? c.phone) : c.phone,
  }));
}

function computeChecklist(supplier: Partial<Supplier>): OnboardingChecklist {
  const existing = supplier.onboarding_checklist ?? {
    contacts_added: false,
    required_certs_defined: false,
    invite_sent: false,
    invite_accepted: false,
    first_cert_uploaded: false,
  };
  return {
    ...existing,
    contacts_added:
      existing.contacts_added ||
      (Array.isArray(supplier.contacts) && supplier.contacts.length > 0),
    required_certs_defined:
      existing.required_certs_defined ||
      (Array.isArray(supplier.required_cert_ids) && supplier.required_cert_ids.length > 0),
  };
}

export async function getSuppliers(filters?: SupplierFilter): Promise<Supplier[]> {
  let query = adminClient.from('suppliers').select('*');
  if (filters?.tier) query = query.eq('tier', filters.tier);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.buyer_link)
    query = query.contains('buyer_links', JSON.stringify([filters.buyer_link]));
  if (filters?.commodity)
    query = query.contains('commodity_tags', JSON.stringify([filters.commodity]));
  query = query.order('name', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  return ((data as Supplier[]) ?? []).map((s) => ({
    ...s,
    contacts: decryptContacts(s.contacts),
  }));
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const { data, error } = await adminClient
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  const s = data as Supplier;
  return { ...s, contacts: decryptContacts(s.contacts) };
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const encContacts = encryptContacts(input.contacts);
  const checklistInput: Partial<Supplier> = {
    contacts: encContacts,
    required_cert_ids: input.required_cert_ids ?? [],
    status: (input.status as Supplier['status']) ?? 'onboarding',
  };
  const checklist = computeChecklist(checklistInput);
  const { data, error } = await adminClient
    .from('suppliers')
    .insert({
      ...input,
      contacts: encContacts,
      onboarding_checklist: checklist,
      commodity_tags: input.commodity_tags ?? [],
      buyer_links: input.buyer_links ?? [],
      required_cert_ids: input.required_cert_ids ?? [],
      scorecard: {
        total_submissions: 0,
        approved: 0,
        rejected: 0,
        submitted_on_time: 0,
        submitted_late: 0,
      },
    })
    .select()
    .single();
  if (error) throw error;
  const s = data as Supplier;
  return { ...s, contacts: decryptContacts(s.contacts) };
}

export async function updateSupplier(
  id: string,
  input: Partial<SupplierInput>
): Promise<Supplier> {
  const update: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  if (input.contacts) {
    update.contacts = encryptContacts(input.contacts);
  }

  // Recalculate checklist after update
  const existing = await getSupplierById(id);
  if (existing) {
    const merged: Partial<Supplier> = { ...existing, ...input, status: (input.status as Supplier['status']) ?? existing.status };
    update.onboarding_checklist = computeChecklist(merged);

    // Auto-promote to active when all 5 checklist items complete
    const cl = update.onboarding_checklist as OnboardingChecklist;
    const allDone =
      cl.contacts_added &&
      cl.required_certs_defined &&
      cl.invite_sent &&
      cl.invite_accepted &&
      cl.first_cert_uploaded;
    if (allDone && existing.status === 'onboarding') {
      update.status = 'active';
    }
  }

  const { data, error } = await adminClient
    .from('suppliers')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  const s = data as Supplier;
  return { ...s, contacts: decryptContacts(s.contacts) };
}

export async function getSupplierScorecard(supplierId: string): Promise<Scorecard> {
  const { data, error } = await adminClient
    .from('supplier_certs')
    .select('status, submission_date')
    .eq('supplier_id', supplierId);
  if (error) throw error;

  const certs = data ?? [];
  const total = certs.length;
  const approved = certs.filter((c) => c.status === 'approved').length;
  const rejected = certs.filter((c) => c.status === 'rejected').length;

  const complianceRate = total > 0 ? approved / total : 0;
  const submissionQuality = total > 0 ? approved / total : 0;
  const onTimeRate = 0.8; // Placeholder — real calculation needs deadline data

  return {
    total_submissions: total,
    approved,
    rejected,
    submitted_on_time: Math.round(total * onTimeRate),
    submitted_late: Math.round(total * (1 - onTimeRate)),
    compliance_rate: complianceRate,
    submission_quality: submissionQuality,
    on_time_rate: onTimeRate,
    combined_score:
      complianceRate * 0.4 + submissionQuality * 0.3 + onTimeRate * 0.3,
  };
}
