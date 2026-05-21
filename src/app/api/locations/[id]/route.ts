import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { updateLocation, deactivateLocation, getCertCountByLocation } from '@/lib/db/locations';
import { appendAuditLog } from '@/lib/db/audit-log';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
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

    const location = await updateLocation(id, parsed.data);

    appendAuditLog({
      action_type: 'location.update',
      user_identifier: auth.username,
      target: id,
      detail: location.name,
      ip_address: ip,
    });

    return NextResponse.json(location);
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

    // Check if location is used by any certs
    const certCounts = await getCertCountByLocation();
    const usage = certCounts.find((c) => c.location_id === id);

    if (usage && usage.count > 0) {
      // Deactivate instead of delete
      await deactivateLocation(id);
      appendAuditLog({
        action_type: 'location.deactivate',
        user_identifier: auth.username,
        target: id,
        detail: `Has ${usage.count} certificate(s) — deactivated instead of deleted`,
        ip_address: ip,
      });
      return NextResponse.json({
        success: true,
        message: `Location has ${usage.count} certificate(s) and was deactivated instead of deleted`,
      });
    }

    await deactivateLocation(id);
    appendAuditLog({
      action_type: 'location.delete',
      user_identifier: auth.username,
      target: id,
      ip_address: ip,
    });

    return NextResponse.json({ success: true, message: 'Location deactivated' });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
