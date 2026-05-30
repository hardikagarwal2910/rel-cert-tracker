import { getCertificates, getExpiringSoon } from '@/lib/db/certificates';
import { getPendingReviewQueue } from '@/lib/db/supplier-certs';
import { getLastCronRun } from '@/lib/db/notification-log';
import Link from 'next/link';

export default async function DashboardPage() {
  const [allCerts, expiring7, expiring30, pendingQueue, lastCronRun] = await Promise.all([
    getCertificates().catch(() => []),
    getExpiringSoon(7).catch(() => []),
    getExpiringSoon(30).catch(() => []),
    getPendingReviewQueue().catch(() => []),
    getLastCronRun().catch(() => null),
  ]);

  const expired = allCerts.filter((c) => c.status === 'expired');
  const annualRenewalCost = allCerts.reduce((sum, c) => sum + (c.renewal_cost ?? 0), 0);

  const topUrgent = [...expiring7, ...expiring30]
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    .slice(0, 5);

  const statusBadge = (status: string) => {
    if (status === 'active') return 'bg-green-100 text-green-800';
    if (status === 'expiring_soon') return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>
          Dashboard
        </h1>
        <a
          href="/api/audit-report"
          className="inline-block px-4 py-2 rounded text-sm font-medium"
          style={{ backgroundColor: '#F5C400', color: '#333' }}
        >
          Export Audit Report
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 mb-8">
        <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Certs</p>
          <p className="mt-1 text-3xl font-bold text-gray-800">{allCerts.length}</p>
        </div>
        <div className="rounded-lg border border-amber-200 p-4 bg-amber-50 shadow-sm">
          <p className="text-xs text-amber-700 uppercase tracking-wide">Expiring in 7d</p>
          <p className="mt-1 text-3xl font-bold text-amber-700">{expiring7.length}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 p-4 bg-yellow-50 shadow-sm">
          <p className="text-xs text-yellow-700 uppercase tracking-wide">Expiring in 30d</p>
          <p className="mt-1 text-3xl font-bold text-yellow-700">{expiring30.length}</p>
        </div>
        <div className="rounded-lg border border-red-200 p-4 bg-red-50 shadow-sm">
          <p className="text-xs text-red-700 uppercase tracking-wide">Expired</p>
          <p className="mt-1 text-3xl font-bold text-red-700">{expired.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Annual Renewal Cost</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            ₹{annualRenewalCost.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pending Review Queue</p>
          <p className="mt-1 text-3xl font-bold text-gray-800">{pendingQueue.length}</p>
          <Link href="/review-queue" className="text-sm mt-2 inline-block" style={{ color: '#878687' }}>
            View queue →
          </Link>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Last Notification Run</p>
          <p className="mt-1 text-base font-medium text-gray-700">
            {lastCronRun
              ? lastCronRun.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
              : 'Never'}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Urgently Expiring Certificates</h2>
        </div>
        {topUrgent.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No certs expiring soon.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Expiry</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {topUrgent.map((cert) => (
                <tr key={cert.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/certificates/${cert.id}`} className="hover:underline font-medium text-gray-800">
                      {cert.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{cert.category ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{cert.expiry_date}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(cert.status)}`}>
                      {cert.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
