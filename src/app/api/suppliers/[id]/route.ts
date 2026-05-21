import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getSupplierById, updateSupplier, getSupplierScorecard } from '@/lib/db/suppliers';
import { appendAuditLog } from '@/lib/db/audit-log';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  tier: z.enum(['1', '2', '3']).optional(),
  status: z.string().optional(),
  contacts: z.array(z.object({
    name: z.string().min(1),
    role: z.string().optional(),
    email: z.string().email(),
    phone: z.string().optional(),
  })).optional(),
  commodity_tags: z.array(z.string()).optional(),
  buyer_links: z.array(z.string()).optional(),
  required_cert_ids: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const supplier = await getSupplierById(id);
    if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const scorecard = await getSupplierScorecard(id);
    return NextResponse.json({ ...supplier, scorecard });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supplier = await updateSupplier(id, parsed.data);

    appendAuditLog({
      action_type: 'supplier.update',
      user_identifier: auth.username,
      target: id,
      detail: supplier.name,
      ip_address: ip,
    });

    return NextResponse.json(supplier);
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

    const supplier = await getSupplierById(id);
    if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await updateSupplier(id, { status: 'inactive' } as Parameters<typeof updateSupplier>[1]);

    appendAuditLog({
      action_type: 'supplier.deactivate',
      user_identifier: auth.username,
      target: id,
      detail: supplier.name,
      ip_address: ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
