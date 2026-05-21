import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getUsers, createUser } from '@/lib/db/users';
import { appendAuditLog } from '@/lib/db/audit-log';

const createSchema = z.object({
  username: z.string().min(1),
  email: z.string().email().optional(),
  password: z.string().min(8),
  role: z.literal('staff'),
  name: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const users = await getUsers();
    // Strip password_hash from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const safe = users.map(({ password_hash: _ph, ...u }) => u);
    return NextResponse.json(safe);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const user = await createUser(parsed.data);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _ph2, ...safe } = user;

    appendAuditLog({
      action_type: 'user.create',
      user_identifier: auth.username,
      target: user.id,
      detail: user.username,
      ip_address: ip,
    });

    return NextResponse.json(safe, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
