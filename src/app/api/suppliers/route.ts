import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getSuppliers, createSupplier } from '@/lib/db/suppliers';
import { appendAuditLog } from '@/lib/db/audit-log';

const contactSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  tier: z.enum(['1', '2', '3']).optional(),
  status: z.string().optional(),
  contacts: z.array(contactSchema).optional(),
  commodity_tags: z.array(z.string()).optional(),
  buyer_links: z.array(z.string()).optional(),
  required_cert_ids: z.array(z.string()).optional(),
  notes: z.string().optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const filters = {
      tier: searchParams.get('tier') ?? undefined,
      buyer_link: searchParams.get('buyer_link') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      commodity: searchParams.get('commodity') ?? undefined,
    };

    const suppliers = await getSuppliers(filters);
    return NextResponse.json(suppliers);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supplier = await createSupplier(parsed.data);

    appendAuditLog({
      action_type: 'supplier.create',
      user_identifier: auth.username,
      target: supplier.id,
      detail: supplier.name,
      ip_address: ip,
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
