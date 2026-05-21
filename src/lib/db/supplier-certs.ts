import { adminClient } from '@/lib/supabase/admin';
import type { SupplierCert } from '@/types/database';
import type { SupplierCertInput, ReviewInput } from '@/types';

export async function getSupplierCerts(supplierId: string): Promise<SupplierCert[]> {
  const { data, error } = await adminClient
    .from('supplier_certs')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as SupplierCert[]) ?? [];
}

export async function getPendingReviewQueue(): Promise<SupplierCert[]> {
  const { data, error } = await adminClient
    .from('supplier_certs')
    .select('*, suppliers(name)')
    .eq('status', 'pending_review')
    .order('submission_date', { ascending: true });
  if (error) throw error;
  return (data as SupplierCert[]) ?? [];
}

export async function getSupplierCertById(id: string): Promise<SupplierCert | null> {
  const { data, error } = await adminClient
    .from('supplier_certs')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as SupplierCert;
}

export async function createSupplierCert(input: SupplierCertInput): Promise<SupplierCert> {
  const { data, error } = await adminClient
    .from('supplier_certs')
    .insert({
      ...input,
      status: 'pending_review',
      submission_date: new Date().toISOString(),
      buyer_links: input.buyer_links ?? [],
      version_history: [],
      notification_log: [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as SupplierCert;
}

export async function updateSupplierCertStatus(
  id: string,
  status: 'approved' | 'rejected',
  review: ReviewInput
): Promise<SupplierCert> {
  const reviewEntry = {
    reviewer: review.reviewer,
    reviewed_at: new Date().toISOString(),
    action: status,
    comment: review.comment,
  };

  const { data, error } = await adminClient
    .from('supplier_certs')
    .update({
      status,
      review: reviewEntry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  // If approved: update supplier onboarding checklist first_cert_uploaded
  if (status === 'approved') {
    const cert = data as SupplierCert;
    const { data: sup } = await adminClient
      .from('suppliers')
      .select('onboarding_checklist')
      .eq('id', cert.supplier_id)
      .single();
    if (sup) {
      const existing = (sup as { onboarding_checklist: Record<string, boolean> }).onboarding_checklist;
      const checklist = { ...existing, first_cert_uploaded: true };
      await adminClient
        .from('suppliers')
        .update({ onboarding_checklist: checklist, updated_at: new Date().toISOString() })
        .eq('id', cert.supplier_id);
    }
  }

  return data as SupplierCert;
}

export async function saveOcrResult(
  id: string,
  ocrResult: Record<string, unknown>
): Promise<void> {
  const { error } = await adminClient
    .from('supplier_certs')
    .update({ ocr_result: ocrResult, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
