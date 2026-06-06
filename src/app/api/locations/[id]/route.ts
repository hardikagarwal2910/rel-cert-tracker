import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import {
  updateLocation,
  deactivateLocation,
  reactivateLocation,
  getLocationById,
  getCertCountByLocation,
} from '@/lib/db/locations';
import { appendAuditLog } from '@/lib/db/audit-log';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  nickname: z.string().optional(),
  address_line_1: z.string().min(1).optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
  active: z.boolean().optional(),
});

const actionSchema = z.object({ action: z.enum(['deactivate', 'reactivate']) });

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'EDIT_ENTITY');
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

// PATCH — deactivate / reactivate a location (admin). Deactivation is a soft
// retire (never a delete): existing certs keep their location reference, but the
// location drops out of the cert-form dropdown for new assignments.
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'ARCHIVE_ENTITY');
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const location = await getLocationById(id);
    if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (parsed.data.action === 'deactivate') {
      const certCounts = await getCertCountByLocation();
      const usage = certCounts.find((c) => c.location_id === id);
      await deactivateLocation(id);
      appendAuditLog({
        action_type: 'location.deactivate',
        user_identifier: auth.username,
        target: id,
        detail: usage && usage.count > 0 ? `${location.name} — ${usage.count} certificate(s) retain this location` : location.name,
        ip_address: ip,
      });
      return NextResponse.json({
        success: true,
        active: false,
        message: usage && usage.count > 0
          ? `${usage.count} certificate(s) use this location; it is hidden from new selections but kept for existing records.`
          : 'Location deactivated.',
      });
    }

    await reactivateLocation(id);
    appendAuditLog({
      action_type: 'location.reactivate',
      user_identifier: auth.username,
      target: id,
      detail: location.name,
      ip_address: ip,
    });
    return NextResponse.json({ success: true, active: true, message: 'Location reactivated.' });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'ARCHIVE_ENTITY');
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
