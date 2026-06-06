import { NextRequest, NextResponse } from 'next/server';
import { zipSync, strToU8 } from 'fflate';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { appendAuditLog } from '@/lib/db/audit-log';
import { backupLimiter } from '@/lib/rate-limit';
import { adminClient } from '@/lib/supabase/admin';
import { sanitiseError } from '@/lib/security/sanitise-error';

// Tables included in the backup. Transient/secret tables (otp_codes,
// download_tokens) are intentionally excluded.
const TABLES = [
  'certificates',
  'locations',
  'categories',
  'suppliers',
  'supplier_certs',
  'supplier_required_certs',
  'audit_log',
  'notification_log',
  'pdf_requests',
  'buyers',
  'buyer_visits',
  'users',
] as const;

// Columns stripped from the export so no password/secret hashes leak.
const STRIP: Record<string, string[]> = {
  users: ['password_hash'],
  buyers: ['password_hash', 'email_hash'],
};

async function fetchTable(tableName: string): Promise<unknown[]> {
  const { data, error } = await adminClient.from(tableName).select('*');
  if (error) throw error;
  const strip = STRIP[tableName];
  if (strip) {
    return (data ?? []).map((row: Record<string, unknown>) => {
      const safe = { ...row };
      for (const col of strip) delete safe[col];
      return safe;
    });
  }
  return data ?? [];
}

export async function GET(req: NextRequest) {
  const limited = backupLimiter(req);
  if (limited) return limited;

  try {
    const auth = await requireCap(req, 'BACKUP');
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const dateStr = new Date().toISOString().split('T')[0];

    // Fetch every table (failures on a single table won't abort the backup).
    const entries: Record<string, Uint8Array> = {};
    await Promise.all(
      TABLES.map(async (t) => {
        try {
          const rows = await fetchTable(t);
          entries[`${t}.json`] = strToU8(JSON.stringify(rows, null, 2));
        } catch (e) {
          entries[`${t}.error.txt`] = strToU8(`Failed to export ${t}: ${sanitiseError(e)}`);
        }
      })
    );

    // Pure-JS ZIP (no native deps — reliable on Vercel serverless).
    const zip = zipSync(entries, { level: 6 });

    appendAuditLog({
      action_type: 'backup.export',
      user_identifier: auth.username,
      detail: `Exported ${Object.keys(entries).length} files`,
      ip_address: ip,
    });

    return new Response(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="REL_Backup_${dateStr}.zip"`,
        'Content-Length': String(zip.length),
      },
    });
  } catch (e) {
    console.error('[backup] export failed:', sanitiseError(e));
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
