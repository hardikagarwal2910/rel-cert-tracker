import { adminClient } from '@/lib/supabase/admin';
import type { CertDocument } from '@/types/database';

export interface CertDocumentInput {
  cert_id: string;
  cert_type?: 'internal' | 'supplier';
  doc_type?: 'certificate' | 'test_report' | 'scope_annex' | 'other';
  file_name: string;
  google_drive_file_id: string;
  uploaded_by?: string;
}

export async function createCertDocument(input: CertDocumentInput): Promise<CertDocument> {
  const { data, error } = await adminClient
    .from('cert_documents')
    .insert({
      cert_id: input.cert_id,
      cert_type: input.cert_type ?? 'internal',
      doc_type: input.doc_type ?? 'certificate',
      file_name: input.file_name,
      google_drive_file_id: input.google_drive_file_id,
      uploaded_by: input.uploaded_by ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CertDocument;
}

export async function getCertDocuments(certId: string): Promise<CertDocument[]> {
  const { data, error } = await adminClient
    .from('cert_documents')
    .select('*')
    .eq('cert_id', certId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data as CertDocument[]) ?? [];
}
