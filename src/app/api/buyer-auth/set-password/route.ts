import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { setBuyerPassword } from '@/lib/db/buyers';
import { appendAuditLog } from '@/lib/db/audit-log';

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'A token and a password of at least 8 characters are required.' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    try {
      const buyer = await setBuyerPassword(parsed.data.token, parsed.data.password);
      appendAuditLog({
        action_type: 'buyer.set_password',
        user_identifier: buyer.id,
        target: buyer.id,
        ip_address: ip,
      });
      return NextResponse.json({ success: true });
    } catch {
      // Invalid/expired token or non-approved buyer.
      return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
