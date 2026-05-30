import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/auth/middleware';
import { getExpiringSoon } from '@/lib/db/certificates';
import { getExpiringSupplierCerts, getSupplierCerts } from '@/lib/db/supplier-certs';
import { getSupplierById } from '@/lib/db/suppliers';
import { getNotificationsByCert, logNotification } from '@/lib/db/notification-log';
import { appendAuditLog } from '@/lib/db/audit-log';
import { sendCertExpiryReminder, sendSupplierExpiryReminder } from '@/lib/mailer';

const THRESHOLDS = [60, 30, 15, 7];

// ── Internal cert reminders (to REL) ──────────────────────────────────────────
async function runInternalNotifications(): Promise<number> {
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

// ── Supplier cert reminders (to suppliers) ────────────────────────────────────
async function runSupplierNotifications(): Promise<number> {
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const notifyEmail = process.env.NOTIFICATION_EMAIL ?? '';

  let processed = 0;

  for (const days of THRESHOLDS) {
    const certs = await getExpiringSupplierCerts(days);

    for (const cert of certs) {
      const triggerLabel = `supplier_expiry_${days}d`;

      // Dedup against notification_log (cert id + label + cert_type='supplier')
      const existingLogs = await getNotificationsByCert(cert.id, 'supplier');
      if (existingLogs.some((log) => log.trigger_label === triggerLabel)) continue;

      // Suppress if a renewed cert (same name, later expiry, approved) already exists
      const siblings = await getSupplierCerts(cert.supplier_id);
      const renewed = siblings.some(
        (s) =>
          s.id !== cert.id &&
          s.cert_name === cert.cert_name &&
          s.status === 'approved' &&
          s.expiry_date > cert.expiry_date
      );
      if (renewed) continue;

      // Resolve the supplier's compliance contact, fall back to primary
      const supplier = await getSupplierById(cert.supplier_id);
      if (!supplier) continue;
      const contacts = supplier.contacts ?? [];
      const compliance = contacts.find((c) => (c.role ?? '').toLowerCase().includes('compliance'));
      const contact = compliance ?? contacts[0];
      const recipient = contact?.email;
      if (!recipient) continue;

      const subject = `Action Required — ${cert.cert_name} expires in ${days} days`;
      try {
        await sendSupplierExpiryReminder({
          to: recipient,
          // For 7-day alerts, CC REL so they can follow up
          cc: days === 7 && notifyEmail ? notifyEmail : undefined,
          supplierName: supplier.name,
          certName: cert.cert_name,
          expiryDate: new Date(cert.expiry_date),
          daysRemaining: days,
          portalUrl,
        });

        await logNotification({
          cert_id: cert.id,
          cert_type: 'supplier',
          recipient,
          subject,
          trigger_label: triggerLabel,
          status: 'sent',
        });

        processed++;
      } catch {
        await logNotification({
          cert_id: cert.id,
          cert_type: 'supplier',
          recipient,
          subject,
          trigger_label: triggerLabel,
          status: 'failed',
        });
      }
    }
  }

  return processed;
}

async function runNotifications(): Promise<number> {
  const internal = await runInternalNotifications();
  const supplier = await runSupplierNotifications();
  return internal + supplier;
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
