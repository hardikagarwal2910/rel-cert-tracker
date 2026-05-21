import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { updateUser, deactivateUser } from '@/lib/db/users';
import { appendAuditLog } from '@/lib/db/audit-log';

const updateSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().optional(),
  active: z.boolean().optional(),
});

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const user = await updateUser(id, parsed.data);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _ph, ...safe } = user;

    appendAuditLog({
      action_type: 'user.update',
      user_identifier: auth.username,
      target: id,
      detail: user.username,
      ip_address: ip,
    });

    return NextResponse.json(safe);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    await deactivateUser(id);

    appendAuditLog({
      action_type: 'user.deactivate',
      user_identifier: auth.username,
      target: id,
      ip_address: ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
