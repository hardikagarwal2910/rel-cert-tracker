import { bucketOf, bucketRenewals, bucketCost, type RenewalItem } from '@/lib/renewal-workload';

function item(partial: Partial<RenewalItem>): RenewalItem {
  return {
    id: 'x',
    name: 'Cert',
    type: 'internal',
    issuing_body: null,
    location: null,
    expiry_date: '2026-01-01',
    daysRemaining: 10,
    renewal_cost: null,
    renewal_process_start_date: null,
    ...partial,
  };
}

describe('renewal-workload bucketing', () => {
  it('bucketOf maps day counts to the correct bucket', () => {
    expect(bucketOf(-5)).toBe('overdue');
    expect(bucketOf(0)).toBe('this_week');
    expect(bucketOf(7)).toBe('this_week');
    expect(bucketOf(8)).toBe('this_month');
    expect(bucketOf(30)).toBe('this_month');
    expect(bucketOf(31)).toBe('next_60');
    expect(bucketOf(60)).toBe('next_60');
    expect(bucketOf(61)).toBe('days_90');
    expect(bucketOf(90)).toBe('days_90');
  });

  it('bucketRenewals groups and sorts items by days ascending', () => {
    const items = [
      item({ id: 'a', daysRemaining: -3 }),
      item({ id: 'b', daysRemaining: 5 }),
      item({ id: 'c', daysRemaining: 2 }),
      item({ id: 'd', daysRemaining: 20 }),
      item({ id: 'e', daysRemaining: 45 }),
      item({ id: 'f', daysRemaining: 80 }),
    ];
    const b = bucketRenewals(items);
    expect(b.overdue.map((i) => i.id)).toEqual(['a']);
    expect(b.this_week.map((i) => i.id)).toEqual(['c', 'b']); // sorted asc
    expect(b.this_month.map((i) => i.id)).toEqual(['d']);
    expect(b.next_60.map((i) => i.id)).toEqual(['e']);
    expect(b.days_90.map((i) => i.id)).toEqual(['f']);
  });

  it('bucketCost sums renewal_cost ignoring nulls', () => {
    const items = [
      item({ renewal_cost: 5000 }),
      item({ renewal_cost: null }),
      item({ renewal_cost: 2500 }),
    ];
    expect(bucketCost(items)).toBe(7500);
  });

  it('empty input yields empty buckets', () => {
    const b = bucketRenewals([]);
    expect(b.overdue).toEqual([]);
    expect(b.days_90).toEqual([]);
  });
});
