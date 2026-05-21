import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult, requireSupplierAuth } from '@/lib/auth/middleware';
import { getSupplierCerts, getPendingReviewQueue, createSupplierCert } from '@/lib/db/supplier-certs';
import { getSupplierById } from '@/lib/db/suppliers';
import { appendAuditLog } from '@/lib/db/audit-log';
import { uploadFile, getOrCreateFolder } from '@/lib/google-drive';
import { extractCertFields, compareCertFields } from '@/lib/ocr';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplier_id');
    const status = searchParams.get('status');

    let certs;
    if (status === 'pending_review' && !supplierId) {
      certs = await getPendingReviewQueue();
    } else if (supplierId) {
      certs = await getSupplierCerts(supplierId);
    } else {
      certs = await getPendingReviewQueue();
    }

    return NextResponse.json(certs);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Supplier auth only
    const supplierPayload = await requireSupplierAuth(req);
    if (!isAuthResult(supplierPayload)) return supplierPayload;

    const supplierId = supplierPayload.supplier_id;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const formData = await req.formData();

    // Validate file
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 400 });
    }

    // Extract cert fields from form data
    const certName = formData.get('cert_name')?.toString() ?? '';
    const certNumber = formData.get('cert_number')?.toString();
    const expiryDate = formData.get('expiry_date')?.toString();
    const issuingBody = formData.get('issuing_body')?.toString();

    if (!certName || !expiryDate) {
      return NextResponse.json({ error: 'cert_name and expiry_date are required' }, { status: 400 });
    }

    // Upload to Google Drive
    const supplier = await getSupplierById(supplierId);
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? '';
    const supplierFolder = await getOrCreateFolder('Supplier Certs', rootFolderId);
    const folder = await getOrCreateFolder(supplier.name, supplierFolder);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileId } = await uploadFile({
      fileName: `${certName}_${Date.now()}.pdf`,
      fileBuffer: buffer,
      mimeType: 'application/pdf',
      parentFolderId: folder,
    });

    const cert = await createSupplierCert({
      supplier_id: supplierId,
      cert_name: certName,
      cert_number: certNumber,
      expiry_date: expiryDate,
      issuing_body: issuingBody,
      google_drive_file_id: fileId,
    });

    // Trigger OCR async — fire and forget
    if (process.env.ANTHROPIC_API_KEY) {
      void (async () => {
        try {
          const b64 = buffer.toString('base64');
          const extracted = await extractCertFields(b64);
          const result = compareCertFields(extracted, {
            cert_number: certNumber,
            expiry_date: expiryDate,
            issuing_body: issuingBody,
          });
          const { saveOcrResult } = await import('@/lib/db/supplier-certs');
          await saveOcrResult(cert.id, result as unknown as Record<string, unknown>);
        } catch {
          // OCR failure must never surface to user
        }
      })();
    }

    appendAuditLog({
      action_type: 'supplier_cert.submit',
      user_identifier: supplierPayload.email,
      target: cert.id,
      detail: certName,
      ip_address: ip,
    });

    return NextResponse.json(cert, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
