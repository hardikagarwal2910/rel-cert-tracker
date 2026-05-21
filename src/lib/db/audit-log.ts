import { adminClient } from '@/lib/supabase/admin';
import type { AuditLog } from '@/types/database';
import type { AuditFilter, AuditLogInput } from '@/types';

/**
 * appendAuditLog — fire-and-forget; never await in request handlers.
 * Uses setImmediate to defer execution and avoid blocking the response.
 */
export function appendAuditLog(entry: AuditLogInput): void {
  setImmediate(async () => {
    try {
      await adminClient.from('audit_log').insert({
        user_identifier: entry.user_identifier,
        action_type: entry.action_type,
        target: entry.target,
        detail: entry.detail,
        ip_address: entry.ip_address,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Audit log failures must never break the main request
      console.warn('[audit-log] Failed to append entry:', entry.action_type);
    }
  });
}

export async function getAuditLog(filters?: AuditFilter): Promise<AuditLog[]> {
  const page = filters?.page ?? 1;
  const limit = 100;
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('audit_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.user) query = query.ilike('user_identifier', `%${filters.user}%`);
  if (filters?.action_type) query = query.eq('action_type', filters.action_type);
  if (filters?.from_date) query = query.gte('timestamp', filters.from_date);
  if (filters?.to_date) query = query.lte('timestamp', filters.to_date);

  const { data, error } = await query;
  if (error) throw error;
  return (data as AuditLog[]) ?? [];
}

export async function exportAuditLogCsv(): Promise<string> {
  const { data, error } = await adminClient
    .from('audit_log')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) throw error;

  const rows = (data as AuditLog[]) ?? [];
  const header = 'timestamp,user_identifier,action_type,target,detail,ip_address\n';
  const body = rows
    .map(
      (r) =>
        `"${r.timestamp}","${r.user_identifier ?? ''}","${r.action_type}","${r.target ?? ''}","${r.detail ?? ''}","${r.ip_address ?? ''}"`
    )
    .join('\n');
  return header + body;
}
