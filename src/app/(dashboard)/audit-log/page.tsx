import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuditLog, getDistinctActionTypes } from '@/lib/db/audit-log';
import Link from 'next/link';

interface Props {
  searchParams: { page?: string; action_type?: string; user?: string; from_date?: string; to_date?: string };
}

export default async function AuditLogPage({ searchParams }: Props) {
  const headersList = headers();
  const role = headersList.get('x-user-role');
  if (role !== 'admin') redirect('/');

  const page = parseInt(searchParams.page ?? '1', 10);
  const filters = {
    page: isNaN(page) ? 1 : page,
    action_type: searchParams.action_type || undefined,
    user: searchParams.user || undefined,
    from_date: searchParams.from_date || undefined,
    to_date: searchParams.to_date || undefined,
  };

  const [entries, actionTypes] = await Promise.all([
    getAuditLog(filters).catch(() => []),
    getDistinctActionTypes().catch(() => [] as string[]),
  ]);

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (filters.action_type) sp.set('action_type', filters.action_type);
    if (filters.user) sp.set('user', filters.user);
    if (filters.from_date) sp.set('from_date', filters.from_date);
    if (filters.to_date) sp.set('to_date', filters.to_date);
    sp.set('page', String(p));
    return `/audit-log?${sp.toString()}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>Audit Log</h1>
        <a href="/api/audit-log/export" className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Export CSV</a>
      </div>

      {/* Filters (native GET form) */}
      <form method="GET" className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Action type</label>
          <select name="action_type" defaultValue={filters.action_type ?? ''} className="border border-gray-300 rounded px-3 py-1.5 text-sm">
            <option value="">All</option>
            {actionTypes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">User</label>
          <input name="user" defaultValue={filters.user ?? ''} placeholder="username" className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" name="from_date" defaultValue={filters.from_date ?? ''} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" name="to_date" defaultValue={filters.to_date ?? ''} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
        </div>
        <button type="submit" className="px-4 py-1.5 rounded text-sm font-medium" style={{ backgroundColor: '#878687', color: '#fff' }}>Filter</button>
        <Link href="/audit-log" className="px-3 py-1.5 text-sm text-gray-500 hover:underline">Clear</Link>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Action Type</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No log entries.</td></tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-700">{entry.user_identifier ?? '—'}</td>
                  <td className="px-4 py-2"><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{entry.action_type}</span></td>
                  <td className="px-4 py-2 text-gray-600">{entry.target ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{entry.detail ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4 items-center">
        {filters.page > 1 && <Link href={pageHref(filters.page - 1)} className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Previous</Link>}
        <span className="text-sm text-gray-600">Page {filters.page}</span>
        {entries.length === 100 && <Link href={pageHref(filters.page + 1)} className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Next</Link>}
      </div>
    </div>
  );
}
