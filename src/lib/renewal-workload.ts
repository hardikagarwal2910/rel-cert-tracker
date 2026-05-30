export type BucketKey = 'overdue' | 'this_week' | 'this_month' | 'next_60' | 'days_90';

export interface RenewalItem {
  id: string;
  name: string;
  type: 'internal' | 'supplier';
  issuing_body: string | null;
  location: string | null;
  expiry_date: string;
  daysRemaining: number;
  renewal_cost: number | null;
  renewal_process_start_date: string | null;
}

export const BUCKET_ORDER: BucketKey[] = ['overdue', 'this_week', 'this_month', 'next_60', 'days_90'];

export const BUCKET_LABELS: Record<BucketKey, string> = {
  overdue: 'Overdue',
  this_week: 'This Week (0–7 days)',
  this_month: 'This Month (8–30 days)',
  next_60: 'Next 60 Days (31–60 days)',
  days_90: '61–90 Days',
};

export function bucketOf(daysRemaining: number): BucketKey {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 7) return 'this_week';
  if (daysRemaining <= 30) return 'this_month';
  if (daysRemaining <= 60) return 'next_60';
  return 'days_90';
}

/**
 * Bucket renewal items (already filtered to ≤ 90 days remaining) into the
 * five workload buckets, each sorted by expiry ascending.
 */
export function bucketRenewals(items: RenewalItem[]): Record<BucketKey, RenewalItem[]> {
  const buckets: Record<BucketKey, RenewalItem[]> = {
    overdue: [],
    this_week: [],
    this_month: [],
    next_60: [],
    days_90: [],
  };
  for (const item of items) {
    buckets[bucketOf(item.daysRemaining)].push(item);
  }
  for (const key of BUCKET_ORDER) {
    buckets[key].sort((a, b) => a.daysRemaining - b.daysRemaining);
  }
  return buckets;
}

export function bucketCost(items: RenewalItem[]): number {
  return items.reduce((sum, i) => sum + (i.renewal_cost ?? 0), 0);
}
