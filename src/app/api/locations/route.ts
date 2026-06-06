import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { getLocations, createLocation } from '@/lib/db/locations';
import { appendAuditLog } from '@/lib/db/audit-log';

const createSchema = z.object({
  name: z.string().min(1),
  nickname: z.string().optional(),
  address_line_1: z.string().min(1),
  address_line_2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  country: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'VIEW_DATA');
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') === 'true';
    const locations = await getLocations(activeOnly);
    return NextResponse.json(locations);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Staff may ADD locations; editing/deactivating stays admin-only (see [id] route).
    const auth = await requireCap(req, 'ADD_ENTITY');
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const location = await createLocation(parsed.data);

    appendAuditLog({
      action_type: 'location.create',
      user_identifier: auth.username,
      target: location.id,
      detail: location.name,
      ip_address: ip,
    });

    return NextResponse.json(location, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
