import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getPdfRequests, createPdfRequest } from '@/lib/db/pdf-requests';
import { appendAuditLog } from '@/lib/db/audit-log';
import { sendPdfRequestNotification } from '@/lib/mailer';

const createSchema = z.object({
  cert_id: z.string().min(1),
  buyer_name: z.string().min(1),
  buyer_company: z.string().min(1),
  buyer_email: z.string().email(),
  cert_name: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? undefined;
    const requests = await getPdfRequests(status);
    return NextResponse.json(requests);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const request = await createPdfRequest(parsed.data);

    const approverEmail = process.env.PDF_APPROVER_EMAIL ?? '';
    const ccEmail = process.env.NOTIFICATION_EMAIL ?? '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

    const approveUrl = `${appUrl}/api/pdf-requests/${request.id}/approve?token=${request.id}`;
    const denyUrl = `${appUrl}/api/pdf-requests/${request.id}/deny?token=${request.id}`;

    if (approverEmail) {
      await sendPdfRequestNotification({
        to: approverEmail,
        cc: ccEmail,
        buyerName: parsed.data.buyer_name,
        buyerCompany: parsed.data.buyer_company,
        certName: parsed.data.cert_name,
        approveUrl,
        denyUrl,
      });
    }

    appendAuditLog({
      action_type: 'pdf_request.create',
      user_identifier: parsed.data.buyer_email,
      target: request.id,
      detail: parsed.data.cert_name,
      ip_address: ip,
    });

    return NextResponse.json({ success: true, id: request.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
