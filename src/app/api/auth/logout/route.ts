import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { appendAuditLog } from '@/lib/db/audit-log';

export async function POST(req: NextRequest) {
  try {
    const username = req.headers.get('x-user-name') ?? 'unknown';
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const cookieStore = await cookies();
    // Clear NextAuth session cookie
    cookieStore.delete('next-auth.session-token');
    cookieStore.delete('__Secure-next-auth.session-token');
    // Clear supplier JWT cookie
    cookieStore.delete('rel_supplier_token');

    appendAuditLog({
      action_type: 'auth.logout',
      user_identifier: username,
      ip_address: ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
