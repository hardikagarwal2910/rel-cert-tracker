import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getCertificateById, updateCertificate } from '@/lib/db/certificates';
import { appendAuditLog } from '@/lib/db/audit-log';
import { uploadFile, getOrCreateFolder, renameFile } from '@/lib/google-drive';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? '';

    // Get or create folder named after cert id
    const folder = await getOrCreateFolder(cert.id, rootFolderId);

    // Rename existing file to versioned name if it exists
    if (cert.google_drive_file_id) {
      const dateStr = new Date().toISOString().split('T')[0];
      // Count existing versions to determine next version number
      const versionNum = (cert.version_history?.length ?? 0) + 1;
      await renameFile(cert.google_drive_file_id, `v${versionNum}_${dateStr}.pdf`);
    }

    // Upload new file as current.pdf
    const { fileId } = await uploadFile({
      fileName: 'current.pdf',
      fileBuffer: buffer,
      mimeType: 'application/pdf',
      parentFolderId: folder,
    });

    await updateCertificate(id, { google_drive_file_id: fileId });

    appendAuditLog({
      action_type: 'certificate.upload_pdf',
      user_identifier: auth.username,
      target: id,
      detail: cert.name,
      ip_address: ip,
    });

    return NextResponse.json({ success: true, file_id: fileId });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
