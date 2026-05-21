import { NextRequest, NextResponse } from 'next/server';
import { validateAndUseToken } from '@/lib/db/download-tokens';
import { getCertificateById } from '@/lib/db/certificates';
import { appendAuditLog } from '@/lib/db/audit-log';
import { generateDownloadLink } from '@/lib/google-drive';
import { downloadLimiter } from '@/lib/rate-limit';

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const limited = downloadLimiter(req);
  if (limited) return limited;

  try {
    const { token } = await context.params;
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const result = await validateAndUseToken(token);
    if (!result) {
      return NextResponse.json({ error: 'Invalid, expired, or already used download link' }, { status: 403 });
    }

    const cert = await getCertificateById(result.certId);
    if (!cert || !cert.google_drive_file_id) {
      return NextResponse.json({ error: 'Certificate PDF not found' }, { status: 404 });
    }

    const driveUrl = await generateDownloadLink(cert.google_drive_file_id);

    appendAuditLog({
      action_type: 'pdf_download.used',
      user_identifier: 'buyer',
      target: result.certId,
      detail: cert.name,
      ip_address: ip,
    });

    return NextResponse.redirect(driveUrl);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
