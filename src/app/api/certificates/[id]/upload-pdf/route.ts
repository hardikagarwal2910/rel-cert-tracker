import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getCertificateById, updateCertificate } from '@/lib/db/certificates';
import { createCertDocument } from '@/lib/db/cert-documents';
import { appendAuditLog } from '@/lib/db/audit-log';
import { uploadFile, getOrCreateFolder, renameFile } from '@/lib/google-drive';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const DOC_TYPES = ['certificate', 'test_report', 'scope_annex', 'other'] as const;
type DocType = (typeof DOC_TYPES)[number];

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const cert = await getCertificateById(id);
    if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 400 });
    }

    const docTypeRaw = formData.get('doc_type')?.toString() ?? 'certificate';
    const docType: DocType = (DOC_TYPES as readonly string[]).includes(docTypeRaw)
      ? (docTypeRaw as DocType)
      : 'certificate';

    const buffer = Buffer.from(await file.arrayBuffer());
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? '';

    // Get or create folder named after cert id
    const folder = await getOrCreateFolder(cert.id, rootFolderId);

    // For the PRIMARY certificate doc, version the previous current.pdf.
    if (docType === 'certificate' && cert.google_drive_file_id) {
      const dateStr = new Date().toISOString().split('T')[0];
      const versionNum = (cert.version_history?.length ?? 0) + 1;
      await renameFile(cert.google_drive_file_id, `v${versionNum}_${dateStr}.pdf`);
    }

    const safeName = file.name?.replace(/[^a-zA-Z0-9._-]+/g, '_') || `${docType}.pdf`;
    const { fileId } = await uploadFile({
      fileName: docType === 'certificate' ? 'current.pdf' : `${docType}_${safeName}`,
      fileBuffer: buffer,
      mimeType: 'application/pdf',
      parentFolderId: folder,
    });

    // Record the document (multi-doc support).
    await createCertDocument({
      cert_id: id,
      cert_type: 'internal',
      doc_type: docType,
      file_name: file.name ?? `${docType}.pdf`,
      google_drive_file_id: fileId,
      uploaded_by: auth.id,
    });

    // Keep the primary google_drive_file_id on the cert for backward compat.
    if (docType === 'certificate') {
      await updateCertificate(id, { google_drive_file_id: fileId });
    }

    appendAuditLog({
      action_type: 'certificate.upload_pdf',
      user_identifier: auth.username,
      target: id,
      detail: `${cert.name} (${docType})`,
      ip_address: ip,
    });

    return NextResponse.json({ success: true, file_id: fileId, doc_type: docType });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
