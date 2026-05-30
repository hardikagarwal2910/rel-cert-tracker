import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getCertificates, createCertificate } from '@/lib/db/certificates';
import { appendAuditLog } from '@/lib/db/audit-log';

const createSchema = z.object({
  name: z.string().min(1),
  expiry_date: z.string().min(1),
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
  google_drive_file_id: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff', 'guest']);
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const filters = {
      category: searchParams.get('category') ?? undefined,
      buyer_tag: searchParams.get('buyer_tag') ?? undefined,
      location_id: searchParams.get('location_id') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      view: (searchParams.get('view') as 'internal' | 'supplier' | undefined) ?? undefined,
    };

    const certs = await getCertificates(filters);
    return NextResponse.json(certs);
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

    const cert = await createCertificate(parsed.data);

    appendAuditLog({
      action_type: 'certificate.create',
      user_identifier: auth.username,
      target: cert.id,
      detail: cert.name,
      ip_address: ip,
    });

    return NextResponse.json(cert, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
