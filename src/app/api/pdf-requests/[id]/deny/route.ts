import { NextRequest, NextResponse } from 'next/server';
import { denyPdfRequest, getPdfRequests } from '@/lib/db/pdf-requests';
import { appendAuditLog } from '@/lib/db/audit-log';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token || token !== id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const requests = await getPdfRequests('pending');
    const pdfRequest = requests.find((r) => r.id === id);
    if (!pdfRequest) {
      return NextResponse.json({ error: 'Request not found or already processed' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const comment = (body?.comment as string) ?? 'Request denied';

    await denyPdfRequest(id, 'approver', comment);

    appendAuditLog({
      action_type: 'pdf_request.deny',
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
