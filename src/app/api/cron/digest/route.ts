import { NextRequest, NextResponse } from 'next/server';
import { requireCap, isAuthResult } from '@/lib/auth/middleware';
import { getCertificates, getExpiringSoon } from '@/lib/db/certificates';
import { getPendingReviewQueue } from '@/lib/db/supplier-certs';
import { getBuyers } from '@/lib/db/buyers';
import { logNotification } from '@/lib/db/notification-log';
import { appendAuditLog } from '@/lib/db/audit-log';
import { sendWeeklyDigest } from '@/lib/mailer';

async function buildAndSend(): Promise<{ sent: boolean; summary: Record<string, number> }> {
  const notifyEmail = process.env.NOTIFICATION_EMAIL ?? '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (!notifyEmail) return { sent: false, summary: {} };

  const [e7, e30, e60, certs, supplierReview, pendingBuyers] = await Promise.all([
    getExpiringSoon(7).catch(() => []),
    getExpiringSoon(30).catch(() => []),
    getExpiringSoon(60).catch(() => []),
    getCertificates({ view: 'internal' }).catch(() => []),
    getPendingReviewQueue().catch(() => []),
    getBuyers('pending').catch(() => []),
  ]);

  const renewalsInProgress = certs.filter((c) => {
    const s = (c as unknown as { renewal_stage?: string }).renewal_stage;
    return s === 'in_progress' || s === 'awaiting_issuer';
  }).length;

  const summary = {
    expiring7: e7.length,
    expiring30: e30.length,
    expiring60: e60.length,
    renewalsInProgress,
    supplierReview: supplierReview.length,
    pendingBuyers: pendingBuyers.length,
  };

  await sendWeeklyDigest({ to: notifyEmail, appUrl, ...summary });
  logNotification({ cert_type: 'internal', recipient: notifyEmail, subject: 'REL Weekly Compliance Digest', trigger_label: 'digest', status: 'sent' });

  return { sent: true, summary };
}

// Vercel cron — CRON_SECRET gated.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await buildAndSend();
    appendAuditLog({ action_type: 'cron.digest', user_identifier: 'cron', detail: JSON.stringify(result.summary), ip_address: 'cron' });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

// Manual trigger by admin.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireCap(req, 'SETTINGS');
    if (!isAuthResult(auth)) return auth;
    const result = await buildAndSend();
    appendAuditLog({ action_type: 'cron.digest.manual', user_identifier: auth.username, detail: JSON.stringify(result.summary), ip_address: req.headers.get('x-forwarded-for') ?? 'unknown' });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
