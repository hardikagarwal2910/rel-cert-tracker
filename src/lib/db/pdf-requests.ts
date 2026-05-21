import { adminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/encryption';
import type { PdfRequest } from '@/types/database';
import type { PdfRequestInput } from '@/types';

export async function createPdfRequest(input: PdfRequestInput): Promise<PdfRequest> {
  const { data, error } = await adminClient
    .from('pdf_requests')
    .insert({
      cert_id: input.cert_id,
      buyer_name: input.buyer_name,
      buyer_company: input.buyer_company,
      buyer_email: input.buyer_email ? encrypt(input.buyer_email) : null,
      cert_name: input.cert_name,
      status: 'pending',
      requested_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as PdfRequest;
}

export async function getPdfRequests(status?: string): Promise<PdfRequest[]> {
  let query = adminClient
    .from('pdf_requests')
    .select('*')
    .order('requested_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as PdfRequest[]) ?? [];
}

export async function approvePdfRequest(id: string, reviewer: string): Promise<PdfRequest> {
  const { data, error } = await adminClient
    .from('pdf_requests')
    .update({
      status: 'approved',
      reviewer,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PdfRequest;
}

export async function denyPdfRequest(
  id: string,
  reviewer: string,
  comment: string
): Promise<PdfRequest> {
  const { data, error } = await adminClient
    .from('pdf_requests')
    .update({
      status: 'denied',
      reviewer,
      comment,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PdfRequest;
}
