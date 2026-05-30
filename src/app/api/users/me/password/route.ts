import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getUserById, updateUser } from '@/lib/db/users';
import { appendAuditLog } from '@/lib/db/audit-log';

// Accept both camelCase (used by the Settings page) and snake_case.
const schema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    current_password: z.string().optional(),
    new_password: z.string().optional(),
  })
  .transform((d) => ({
    currentPassword: d.currentPassword ?? d.current_password ?? '',
    newPassword: d.newPassword ?? d.new_password ?? '',
  }))
  .refine((d) => d.currentPassword.length > 0, { message: 'Current password is required' })
  .refine((d) => d.newPassword.length >= 6, { message: 'New password must be at least 6 characters' });

async function handle(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await getUserById(auth.id);
    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    await updateUser(auth.id, { password: newPassword });

    appendAuditLog({
      action_type: 'user.password_change',
      user_identifier: auth.username,
      target: auth.id,
      ip_address: ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
