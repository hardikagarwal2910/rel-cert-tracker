import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { suspendBuyer } from '@/lib/db/buyers';
import { appendAuditLog } from '@/lib/db/audit-log';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const buyer = await suspendBuyer(id, auth.id);

    appendAuditLog({
      action_type: 'buyer.suspend',
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
