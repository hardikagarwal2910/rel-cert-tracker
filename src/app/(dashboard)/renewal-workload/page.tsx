import Link from 'next/link';
import { differenceInCalendarDays } from 'date-fns';
import { getCertificates } from '@/lib/db/certificates';
import { getLocations } from '@/lib/db/locations';
import {
  bucketRenewals,
  bucketCost,
  BUCKET_ORDER,
  BUCKET_LABELS,
  type RenewalItem,
} from '@/lib/renewal-workload';

const TAUPE = '#878687';

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function urgencyColor(days: number): string {
  if (days < 0) return '#dc2626';
  if (days <= 7) return '#dc2626';
  if (days <= 30) return '#f59e0b';
  return '#6b7280';
}

export default async function RenewalWorkloadPage() {
  const [certs, locations] = await Promise.all([
    getCertificates().catch(() => []),
    getLocations().catch(() => []),
  ]);

  const locMap = new Map(locations.map((l) => [l.id, l.name]));
  const today = new Date();

  const items: RenewalItem[] = certs
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: (c.submitted_by_supplier ? 'supplier' : 'internal') as RenewalItem['type'],
      issuing_body: c.issuing_body ?? null,
      location: c.location_id ? locMap.get(c.location_id) ?? null : null,
      expiry_date: c.expiry_date,
      daysRemaining: differenceInCalendarDays(new Date(c.expiry_date), today),
      renewal_cost: c.renewal_cost ?? null,
      renewal_process_start_date: c.renewal_process_start_date ?? null,
    }))
    .filter((i) => i.daysRemaining <= 90);

  const buckets = bucketRenewals(items);
  const totalCount = items.length;
  const totalCost = bucketCost(items);
  const overdueCount = buckets.overdue.length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: TAUPE }}>
        Renewal Workload
      </h1>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Upcoming Renewals (90d)</p>
          <p className="mt-1 text-3xl font-bold text-gray-800">{totalCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Renewal Cost</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{inr(totalCost)}</p>
        </div>
        <div className="rounded-lg border border-red-200 p-4 bg-red-50 shadow-sm">
          <p className="text-xs text-red-700 uppercase tracking-wide">Overdue</p>
          <p className="mt-1 text-3xl font-bold text-red-700">{overdueCount}</p>
        </div>
      </div>

      {totalCount === 0 && (
        <p className="text-sm text-gray-500">No renewals due in the next 90 days.</p>
      )}

      {/* Buckets */}
      {BUCKET_ORDER.map((key) => {
        const rows = buckets[key];
        if (rows.length === 0) return null;
        const cost = bucketCost(rows);
        return (
          <div key={key} className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">
                {BUCKET_LABELS[key]} <span className="text-gray-400">({rows.length})</span>
              </h2>
              <span className="text-xs text-gray-500">Total: {inr(cost)}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-4 py-2">Certificate</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Issuing Body</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Expiry</th>
                  <th className="px-4 py-2">Days</th>
                  <th className="px-4 py-2">Renewal Cost</th>
                  <th className="px-4 py-2">Process Started</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/certificates/${r.id}`} className="font-medium text-gray-800 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-600 capitalize">{r.type}</td>
                    <td className="px-4 py-2 text-gray-600">{r.issuing_body ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.location ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.expiry_date}</td>
                    <td className="px-4 py-2">
                      <span className="font-medium" style={{ color: urgencyColor(r.daysRemaining) }}>
                        {r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)}d overdue` : `${r.daysRemaining}d`}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{r.renewal_cost != null ? inr(r.renewal_cost) : '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.renewal_process_start_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
