import { adminClient } from '@/lib/supabase/admin';
import type { NotificationLog } from '@/types/database';
import type { NotificationLogInput } from '@/types';

export async function logNotification(entry: NotificationLogInput): Promise<void> {
  const { error } = await adminClient.from('notification_log').insert({
    cert_id: entry.cert_id,
    cert_type: entry.cert_type,
    recipient: entry.recipient,
    subject: entry.subject,
    trigger_label: entry.trigger_label,
    timestamp_sent: new Date().toISOString(),
    status: entry.status,
    error_message: entry.error_message,
  });
  if (error) throw error;
}

export async function getNotificationsByCert(
  certId: string,
  certType: string
): Promise<NotificationLog[]> {
  const { data, error } = await adminClient
    .from('notification_log')
    .select('*')
    .eq('cert_id', certId)
    .eq('cert_type', certType)
    .order('timestamp_sent', { ascending: false });
  if (error) throw error;
  return (data as NotificationLog[]) ?? [];
}

export async function getLastCronRun(): Promise<Date | null> {
  const { data, error } = await adminClient
    .from('audit_log')
    .select('timestamp')
    .eq('action_type', 'cron.notifications.complete')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return new Date((data as { timestamp: string }).timestamp);
}
