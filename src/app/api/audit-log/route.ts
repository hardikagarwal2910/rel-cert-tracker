import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getAuditLog, exportAuditLogCsv } from '@/lib/db/audit-log';
import { adminLimiter } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const isExport = searchParams.get('export') === 'csv';

    if (isExport) {
      const limited = adminLimiter(req);
      if (limited) return limited;

      const csv = await exportAuditLogCsv();
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit_log_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Paginated list
    const cursor = searchParams.get('cursor');
    const page = cursor ? parseInt(cursor, 10) : 1;
    const filters = {
      user: searchParams.get('user') ?? undefined,
      action_type: searchParams.get('action_type') ?? undefined,
      from_date: searchParams.get('from_date') ?? undefined,
      to_date: searchParams.get('to_date') ?? undefined,
      page: isNaN(page) ? 1 : page,
    };

    const entries = await getAuditLog(filters);
    return NextResponse.json({
      data: entries,
      next_cursor: entries.length === 100 ? String(page + 1) : null,
    });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
