import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getExpiringSoon } from '@/lib/db/certificates';
import { getNotificationsByCert, logNotification } from '@/lib/db/notification-log';
import { appendAuditLog } from '@/lib/db/audit-log';
import { sendCertExpiryReminder } from '@/lib/mailer';

const THRESHOLDS = [60, 30, 15, 7];

async function runNotifications(): Promise<number> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const notifyEmail = process.env.NOTIFICATION_EMAIL ?? '';

  if (!notifyEmail) return 0;

  let processed = 0;

  for (const days of THRESHOLDS) {
    const certs = await getExpiringSoon(days);

    for (const cert of certs) {
      const triggerLabel = `expiry_${days}d`;

      // Check if already sent for this cert + threshold
      const existingLogs = await getNotificationsByCert(cert.id, 'internal');
      const alreadySent = existingLogs.some((log) => log.trigger_label === triggerLabel);
      if (alreadySent) continue;

      try {
        const expiryDate = new Date(cert.expiry_date);
        await sendCertExpiryReminder({
          to: notifyEmail,
          certName: cert.name,
          expiryDate,
          daysRemaining: days,
          buyerTags: cert.buyer_tags ?? [],
          renewalCost: cert.renewal_cost ?? undefined,
          appUrl,
        });

        await logNotification({
          cert_id: cert.id,
          cert_type: 'internal',
          recipient: notifyEmail,
          subject: `Certificate Expiry Alert — ${cert.name} (${days} days)`,
          trigger_label: triggerLabel,
          status: 'sent',
        });

        processed++;
      } catch {
        await logNotification({
          cert_id: cert.id,
          cert_type: 'internal',
          recipient: notifyEmail,
          subject: `Certificate Expiry Alert — ${cert.name} (${days} days)`,
          trigger_label: triggerLabel,
          status: 'failed',
        });
      }
    }
  }

  return processed;
}

// Vercel cron — validate CRON_SECRET
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const processed = await runNotifications();

    appendAuditLog({
      action_type: 'cron.notifications.complete',
      user_identifier: 'cron',
      detail: `Processed ${processed} notifications`,
      ip_address: 'cron',
    });

    return NextResponse.json({ processed });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

// Manual trigger by admin
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if (!isAuthResult(auth)) return auth;

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

    const processed = await runNotifications();

    appendAuditLog({
      action_type: 'cron.notifications.manual',
      user_identifier: auth.username,
      detail: `Processed ${processed} notifications`,
      ip_address: ip,
    });

    return NextResponse.json({ processed });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
