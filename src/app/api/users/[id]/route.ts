import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { canManageUser, canAssignRole } from '@/lib/auth/permissions';
import { getUserById, updateUser, deactivateUser } from '@/lib/db/users';
import { appendAuditLog } from '@/lib/db/audit-log';

const updateSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  display_name: z.string().optional(),
  role: z.enum(['admin', 'manager', 'staff', 'viewer']).optional(),
  active: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  action: z.literal('reset_password'),
  password: z.string().min(8),
});

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'MANAGE_USERS');
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const target = await getUserById(id);
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // A manager may only manage staff/viewer accounts — never an admin/manager.
    if (!canManageUser(auth.role, target.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Role change is hierarchy-guarded and never allowed on your own account.
    if (parsed.data.role && parsed.data.role !== target.role) {
      if (id === auth.id) {
        return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 403 });
      }
      if (!canAssignRole(auth.role, parsed.data.role)) {
        return NextResponse.json({ error: 'You are not allowed to assign that role.' }, { status: 403 });
      }
    }

    const roleChanged = !!parsed.data.role && parsed.data.role !== target.role;
    const user = await updateUser(id, parsed.data);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _ph, ...safe } = user;

    appendAuditLog({
      action_type: roleChanged ? 'user.role_change' : 'user.update',
      user_identifier: auth.username,
      target: id,
      detail: roleChanged ? `${user.username}: ${target.role} → ${parsed.data.role}` : user.username,
      ip_address: ip,
    });

    return NextResponse.json(safe);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

// PATCH — reset another user's password (no email). Hierarchy-guarded.
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'MANAGE_USERS');
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const target = await getUserById(id);
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageUser(auth.role, target.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const user = await updateUser(id, { password: parsed.data.password });

    appendAuditLog({
      action_type: 'user.password_reset',
      user_identifier: auth.username,
      target: id,
      detail: user.username,
      ip_address: ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'MANAGE_USERS');
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    if (id === auth.id) {
      return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 403 });
    }

    const target = await getUserById(id);
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageUser(auth.role, target.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await deactivateUser(id);

    appendAuditLog({
      action_type: 'user.deactivate',
      user_identifier: auth.username,
      target: id,
      detail: target.username,
      ip_address: ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
