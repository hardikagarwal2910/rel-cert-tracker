import { NextRequest } from 'next/server';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { exportAuditLogCsv } from '@/lib/db/audit-log';
import { adminLimiter } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'VIEW_AUDIT_LOG');
    if (!isAuthResult(auth)) return auth;

    const limited = adminLimiter(req);
    if (limited) return limited;

    const csv = await exportAuditLogCsv();
    const date = new Date().toISOString().split('T')[0];

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="REL_AuditLog_${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
