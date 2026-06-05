import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import {
  getCertificateById,
  updateCertificate,
  deleteCertificate,
  archiveCertificate,
  unarchiveCertificate,
} from '@/lib/db/certificates';
import { appendAuditLog } from '@/lib/db/audit-log';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  expiry_date: z.string().optional(),
  cert_number: z.string().optional(),
  category: z.string().optional(),
  location_id: z.string().optional(),
  issue_date: z.string().optional(),
  renewal_process_start_date: z.string().optional(),
  buyer_visible: z.boolean().optional(),
  buyer_tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  renewal_cost: z.number().optional(),
  issuing_body: z.string().optional(),
  renewal_stage: z.enum(['not_started', 'in_progress', 'awaiting_issuer', 'renewed']).optional(),
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff', 'guest']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const cert = await getCertificateById(id);
    if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Guest: only buyer_visible certs
    if (auth.role === 'guest' && !cert.buyer_visible) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(cert);
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

    const cert = await updateCertificate(id, parsed.data);

    appendAuditLog({
      action_type: parsed.data.renewal_stage ? 'certificate.renewal_stage' : 'certificate.update',
      user_identifier: auth.username,
      target: id,
      detail: parsed.data.renewal_stage ? `${cert.name} → ${parsed.data.renewal_stage}` : cert.name,
      ip_address: ip,
    });

    return NextResponse.json(cert);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

const actionSchema = z.object({ action: z.enum(['archive', 'unarchive']) });

// PATCH — soft-delete (archive) / restore a certificate. Reversible, so this is
// allowed for admin and staff (unlike DELETE which is admin-only).
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await getCertificateById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const cert =
      parsed.data.action === 'archive'
        ? await archiveCertificate(id, auth.id)
        : await unarchiveCertificate(id);

    appendAuditLog({
      action_type: parsed.data.action === 'archive' ? 'certificate.archive' : 'certificate.unarchive',
      user_identifier: auth.username,
      target: id,
      detail: cert.name,
      ip_address: ip,
    });

    return NextResponse.json(cert);
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

    const cert = await getCertificateById(id);
    if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await deleteCertificate(id);

    appendAuditLog({
      action_type: 'certificate.delete',
      user_identifier: auth.username,
      target: id,
      detail: cert.name,
      ip_address: ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
