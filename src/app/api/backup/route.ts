import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { appendAuditLog } from '@/lib/db/audit-log';
import { backupLimiter } from '@/lib/rate-limit';
import { adminClient } from '@/lib/supabase/admin';

const TABLES = [
  'certificates',
  'locations',
  'categories',
  'suppliers',
  'supplier_certs',
  'audit_log',
  'notification_log',
  'pdf_requests',
] as const;

async function fetchTable(tableName: string): Promise<unknown[]> {
  const query = adminClient.from(tableName).select('*');
  const { data, error } = await query;
  if (error) throw error;

  // Strip password_hash from users
  if (tableName === 'users') {
    return (data ?? []).map((u: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password_hash: _ph, ...safe } = u;
      return safe;
    });
  }
  return data ?? [];
}

export async function GET(req: NextRequest) {
  const limited = backupLimiter(req);
  if (limited) return limited;

  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const dateStr = new Date().toISOString().split('T')[0];

    // Fetch all tables
    const tableData: Record<string, unknown[]> = {};

    // Also include users (not in TABLES const to handle separately)
    const allTables = [...TABLES, 'users'] as string[];

    await Promise.all(
      allTables.map(async (t) => {
        tableData[t] = await fetchTable(t);
      })
    );

    // Build ZIP in memory
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', resolve);
      archive.on('error', reject);

      for (const [name, rows] of Object.entries(tableData)) {
        const json = JSON.stringify(rows, null, 2);
        archive.append(Buffer.from(json, 'utf-8'), { name: `${name}.json` });
      }

      archive.finalize();
    });

    const zipBuffer = Buffer.concat(chunks);

    appendAuditLog({
      action_type: 'backup.export',
      user_identifier: auth.username,
      detail: `Exported ${allTables.length} tables`,
      ip_address: ip,
    });

    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="REL_Backup_${dateStr}.zip"`,
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
