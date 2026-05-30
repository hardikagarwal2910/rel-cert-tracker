import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getCertificates } from '@/lib/db/certificates';
import { generateAuditReport } from '@/lib/pdf-generator/audit-report';
import { appendAuditLog } from '@/lib/db/audit-log';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'staff']);
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const certs = await getCertificates();

    const pdf = await generateAuditReport(certs);
    const dateStr = new Date().toISOString().split('T')[0];

    appendAuditLog({
      action_type: 'audit_report.export',
      user_identifier: auth.username,
      detail: `Exported audit report (${certs.length} certificates)`,
      ip_address: ip,
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="REL_Certification_Report_${dateStr}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
