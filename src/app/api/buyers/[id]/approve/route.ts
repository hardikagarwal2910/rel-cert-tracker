import { NextRequest, NextResponse } from 'next/server';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { approveBuyer } from '@/lib/db/buyers';
import { sendBuyerApprovalEmail } from '@/lib/mailer';
import { appendAuditLog } from '@/lib/db/audit-log';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'MANAGE_BUYERS');
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const { buyer, token } = await approveBuyer(id, auth.id);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    if (buyer.email) {
      await sendBuyerApprovalEmail({
        to: buyer.email,
        buyerName: buyer.name,
        setPasswordUrl: `${appUrl}/buyer/set-password?token=${encodeURIComponent(token)}`,
      });
    }

    appendAuditLog({
      action_type: 'buyer.approve',
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
