import { NextRequest, NextResponse } from 'next/server';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { getSupplierCertById, saveOcrResult } from '@/lib/db/supplier-certs';
import { appendAuditLog } from '@/lib/db/audit-log';
import { extractCertFields, compareCertFields } from '@/lib/ocr';
import { generateDownloadLink } from '@/lib/google-drive';
import { ocrLimiter } from '@/lib/rate-limit';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = ocrLimiter(req);
  if (limited) return limited;

  try {
    const auth = await requireCap(req, 'REVIEW_SUPPLIER_CERTS');
    if (!isAuthResult(auth)) return auth;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ available: false });
    }

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const cert = await getSupplierCertById(id);
    if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!cert.google_drive_file_id) {
      return NextResponse.json({ error: 'No PDF uploaded for this certificate' }, { status: 400 });
    }

    // Download PDF from Google Drive
    const downloadUrl = await generateDownloadLink(cert.google_drive_file_id);
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch PDF from Drive' }, { status: 502 });
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const base64 = buffer.toString('base64');

    // Extract and compare
    const extracted = await extractCertFields(base64);
    const result = compareCertFields(extracted, {
      cert_number: cert.cert_number,
      expiry_date: cert.expiry_date,
      issuing_body: cert.issuing_body,
    });

    await saveOcrResult(id, result as unknown as Record<string, unknown>);

    appendAuditLog({
      action_type: 'supplier_cert.ocr',
      user_identifier: auth.username,
      target: id,
      detail: `OCR confidence: ${result.confidence}`,
      ip_address: ip,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
