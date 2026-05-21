import { NextRequest, NextResponse } from 'next/server';
import { approvePdfRequest, getPdfRequests } from '@/lib/db/pdf-requests';
import { createDownloadToken } from '@/lib/db/download-tokens';
import { appendAuditLog } from '@/lib/db/audit-log';
import { sendPdfDownloadLink } from '@/lib/mailer';
import { decrypt } from '@/lib/encryption';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token || token !== id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    // Fetch the request
    const requests = await getPdfRequests('pending');
    const pdfRequest = requests.find((r) => r.id === id);
    if (!pdfRequest) {
      return NextResponse.json({ error: 'Request not found or already processed' }, { status: 404 });
    }

    await approvePdfRequest(id, 'approver');

    // Create one-time download token
    const certId = pdfRequest.cert_id ?? '';
    const buyerEmail = pdfRequest.buyer_email ? (decrypt(pdfRequest.buyer_email) ?? pdfRequest.buyer_email) : '';
    const downloadToken = certId ? await createDownloadToken(certId, buyerEmail) : null;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    if (buyerEmail && downloadToken) {
      const downloadUrl = `${appUrl}/api/download/${downloadToken}`;
      await sendPdfDownloadLink({
        to: buyerEmail,
        certName: pdfRequest.cert_name ?? 'Certificate',
        downloadUrl,
        expiresAt,
      });
    }

    appendAuditLog({
      action_type: 'pdf_request.approve',
      user_identifier: 'approver',
      target: id,
      detail: pdfRequest.cert_name ?? undefined,
      ip_address: ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
