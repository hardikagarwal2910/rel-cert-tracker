import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { renewCertificate } from '@/lib/db/certificates';
import { appendAuditLog } from '@/lib/db/audit-log';

const renewSchema = z.object({
  new_expiry_date: z.string().min(1),
  new_cert_number: z.string().optional(),
  renewal_cost: z.number().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCap(req, 'RENEW_CERT');
    if (!isAuthResult(auth)) return auth;

    const { id } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const body = await req.json();
    const parsed = renewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const cert = await renewCertificate(id, {
      ...parsed.data,
      updated_by: auth.username,
    });

    appendAuditLog({
      action_type: 'certificate.renew',
      user_identifier: auth.username,
      target: id,
      detail: `New expiry: ${parsed.data.new_expiry_date}`,
      ip_address: ip,
    });

    return NextResponse.json(cert);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
