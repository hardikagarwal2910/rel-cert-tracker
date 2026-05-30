import { differenceInCalendarDays } from 'date-fns';
import { getCertificates } from '@/lib/db/certificates';
import { getPendingReviewQueue } from '@/lib/db/supplier-certs';
import { getBuyers } from '@/lib/db/buyers';
import { getPdfRequests } from '@/lib/db/pdf-requests';

export interface ActionItem {
  id: string;
  name: string;
  expiry_date: string;
  days: number;
}

export interface ActionQueue {
  expiringNotStarted: ActionItem[];
  overdue: ActionItem[];
  supplierReviewCount: number;
  pendingBuyerCount: number;
  pdfRequestCount: number;
  total: number;
}

/**
 * Assemble the dashboard "what needs attention" queue with a few targeted
 * queries (no N+1). Internal certs only for the expiry/overdue buckets.
 */
export async function getActionQueue(): Promise<ActionQueue> {
  const [certs, supplierReview, pendingBuyers, pdfRequests] = await Promise.all([
    getCertificates({ view: 'internal' }).catch(() => []),
    getPendingReviewQueue().catch(() => []),
    getBuyers('pending').catch(() => []),
    getPdfRequests('pending').catch(() => []),
  ]);

  const today = new Date();
  const expiringNotStarted: ActionItem[] = [];
  const overdue: ActionItem[] = [];

  for (const c of certs) {
    const days = differenceInCalendarDays(new Date(c.expiry_date), today);
    const stage = (c as unknown as { renewal_stage?: string }).renewal_stage ?? 'not_started';
    if (days < 0 && stage !== 'renewed') {
      overdue.push({ id: c.id, name: c.name, expiry_date: c.expiry_date, days });
    } else if (days >= 0 && days <= 30 && stage === 'not_started') {
      expiringNotStarted.push({ id: c.id, name: c.name, expiry_date: c.expiry_date, days });
    }
  }
  expiringNotStarted.sort((a, b) => a.days - b.days);
  overdue.sort((a, b) => a.days - b.days);

  const total =
    expiringNotStarted.length +
    overdue.length +
    supplierReview.length +
    pendingBuyers.length +
    pdfRequests.length;

  return {
    expiringNotStarted,
    overdue,
    supplierReviewCount: supplierReview.length,
    pendingBuyerCount: pendingBuyers.length,
    pdfRequestCount: pdfRequests.length,
    total,
  };
}
