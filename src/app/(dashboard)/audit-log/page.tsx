import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuditLog } from '@/lib/db/audit-log';
import Link from 'next/link';

interface Props {
  searchParams: { page?: string };
}

export default async function AuditLogPage({ searchParams }: Props) {
  const headersList = headers();
  const role = headersList.get('x-user-role');
  if (role !== 'admin') redirect('/');

  const page = parseInt(searchParams.page ?? '1', 10);
  const entries = await getAuditLog({ page }).catch(() => []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>Audit Log</h1>
        <a
          href="/api/audit-log/export"
          className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
        >
          Export CSV
        </a>
      </div>

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
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No log entries.</td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{entry.user_identifier ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {entry.action_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{entry.target ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{entry.detail ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex gap-2 mt-4 items-center">
        {page > 1 && (
          <Link
            href={`/audit-log?page=${page - 1}`}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Previous
          </Link>
        )}
        <span className="text-sm text-gray-600">Page {page}</span>
        {entries.length === 100 && (
          <Link
            href={`/audit-log?page=${page + 1}`}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
