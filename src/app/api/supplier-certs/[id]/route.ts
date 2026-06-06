import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCap, isAuthResult, requireSupplierAuth } from '@/lib/auth/middleware';
import {
  getSupplierCertById,
  updateSupplierCertStatus,
} from '@/lib/db/supplier-certs';
import { appendAuditLog } from '@/lib/db/audit-log';

const patchSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
  reviewer: z.string().min(1),
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cert = await getSupplierCertById(id);
    if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Try admin/staff auth first
    const adminAuth = await requireCap(req, 'VIEW_DATA');
    if (isAuthResult(adminAuth)) {
      return NextResponse.json(cert);
    }

    // Fall back to supplier auth — verify ownership
    const supplierPayload = await requireSupplierAuth(req);
    if (!isAuthResult(supplierPayload)) return supplierPayload;

    if (cert.supplier_id !== supplierPayload.supplier_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(cert);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'REVIEW_SUPPLIER_CERTS');
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const cert = await getSupplierCertById(id);
    if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Generic update — for now handle status updates via PATCH; PUT used for field updates
    const body = await req.json();
    const { adminClient } = await import('@/lib/supabase/admin');
    const { data, error } = await adminClient
      .from('supplier_certs')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    appendAuditLog({
      action_type: 'supplier_cert.update',
      user_identifier: auth.username,
      target: id,
      ip_address: ip,
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'REVIEW_SUPPLIER_CERTS');
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { action, comment, reviewer } = parsed.data;
    const status = action === 'approve' ? 'approved' : 'rejected';

    const cert = await updateSupplierCertStatus(id, status, { reviewer, comment });

    appendAuditLog({
      action_type: `supplier_cert.${action}`,
      user_identifier: auth.username,
      target: id,
      detail: comment,
      ip_address: ip,
    });

    return NextResponse.json(cert);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
