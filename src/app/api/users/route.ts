import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { canAssignRole } from '@/lib/auth/permissions';
import { getUsers, createUser, getUserByUsername } from '@/lib/db/users';
import { appendAuditLog } from '@/lib/db/audit-log';

const createSchema = z.object({
  username: z.string().min(1),
  display_name: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8),
  // Any of the four tiers may be REQUESTED, but the role-hierarchy guard below
  // decides whether the CURRENT user is allowed to assign it.
  role: z.enum(['admin', 'manager', 'staff', 'viewer']),
  active: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'MANAGE_USERS');
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
    const auth = await requireCap(req, 'CREATE_USER');
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    // ── Role-hierarchy guard (privilege-escalation protection) ──────────────
    // Admin may assign any role; manager may assign ONLY staff/viewer. Enforced
    // server-side regardless of what the client submits.
    if (!canAssignRole(auth.role, parsed.data.role)) {
      return NextResponse.json(
        { error: 'You can only create staff or viewer accounts.' },
        { status: 403 }
      );
    }

    // Clear, friendly duplicate-username error (the column is UNIQUE).
    const existing = await getUserByUsername(parsed.data.username);
    if (existing) {
      return NextResponse.json({ error: `Username "${parsed.data.username}" is already taken` }, { status: 409 });
    }

    const user = await createUser(parsed.data);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _ph2, ...safe } = user;

    appendAuditLog({
      action_type: 'user.create',
      user_identifier: auth.username,
      target: user.id,
      detail: `${user.username} (${parsed.data.role})`,
      ip_address: ip,
    });

    return NextResponse.json(safe, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
