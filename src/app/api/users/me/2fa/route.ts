import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getUserById, setTwoFactor } from '@/lib/db/users';
import { appendAuditLog } from '@/lib/db/audit-log';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const user = await getUserById(auth.id);
    return NextResponse.json({ enabled: user?.two_factor_enabled ?? false });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

const schema = z.object({ enabled: z.boolean() });

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 });
    }

    await setTwoFactor(auth.id, parsed.data.enabled);

    appendAuditLog({
      action_type: 'user.2fa_toggle',
      user_identifier: auth.username,
      target: auth.id,
      detail: parsed.data.enabled ? 'enabled' : 'disabled',
      ip_address: ip,
    });

    return NextResponse.json({ success: true, enabled: parsed.data.enabled });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
