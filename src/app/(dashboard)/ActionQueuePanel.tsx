import Link from 'next/link';
import { getActionQueue } from '@/lib/db/action-queue';

const TAUPE = '#878687';

export default async function ActionQueuePanel() {
  const q = await getActionQueue().catch(() => null);
  if (!q) return null;

  if (q.total === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5 mb-8">
        <p className="text-sm font-medium text-green-800">✓ All caught up — nothing needs attention right now.</p>
      </div>
    );
  }

  const Row = ({ href, label, count, urgent }: { href: string; label: string; count: number; urgent?: boolean }) =>
    count > 0 ? (
      <Link href={href} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-t border-gray-100">
        <span className="text-sm text-gray-700">{label}</span>
        <span
          className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 rounded-full text-xs font-semibold"
          style={urgent ? { backgroundColor: '#fee2e2', color: '#991b1b' } : { backgroundColor: '#F5C400', color: '#333' }}
        >
          {count}
        </span>
      </Link>
    ) : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm mb-8 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: TAUPE }}>Action Queue — {q.total} item{q.total === 1 ? '' : 's'}</h2>
      </div>

      <Row href="/certificates" label="⏰ Overdue certificates (not yet renewed)" count={q.overdue.length} urgent />
      <Row href="/renewal-workload" label="🗓 Expiring ≤30 days, renewal not started" count={q.expiringNotStarted.length} urgent />
      <Row href="/review-queue" label="📥 Supplier certs pending review" count={q.supplierReviewCount} />
      <Row href="/buyer-activity" label="👤 Buyer registrations pending approval" count={q.pendingBuyerCount} />
      <Row href="/pdf-requests" label="📄 PDF requests awaiting approval" count={q.pdfRequestCount} />

      {(q.overdue.length > 0 || q.expiringNotStarted.length > 0) && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Most urgent</p>
          <ul className="space-y-1">
            {[...q.overdue, ...q.expiringNotStarted].slice(0, 5).map((it) => (
              <li key={it.id} className="flex items-center justify-between text-sm">
                <Link href={`/certificates/${it.id}`} className="text-gray-700 hover:underline">{it.name}</Link>
                <span className="text-xs font-medium" style={{ color: it.days < 0 ? '#dc2626' : '#f59e0b' }}>
                  {it.days < 0 ? `${Math.abs(it.days)}d overdue` : `${it.days}d left`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
