import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { rejectBuyer } from '@/lib/db/buyers';
import { sendBuyerRejectionEmail } from '@/lib/mailer';
import { appendAuditLog } from '@/lib/db/audit-log';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const buyer = await rejectBuyer(id, auth.id);

    if (buyer.email) {
      await sendBuyerRejectionEmail({ to: buyer.email, buyerName: buyer.name });
    }

    appendAuditLog({
      action_type: 'buyer.reject',
      user_identifier: auth.username,
      target: id,
      detail: buyer.name,
      ip_address: ip,
    });

    return NextResponse.json({ success: true, status: buyer.status });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
