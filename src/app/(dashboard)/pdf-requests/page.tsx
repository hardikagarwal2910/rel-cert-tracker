import { getPdfRequests } from '@/lib/db/pdf-requests';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    denied: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
};

export default async function PdfRequestsPage() {
  const requests = await getPdfRequests().catch(() => []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>PDF Requests</h1>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-4 py-2">Buyer Name</th>
              <th className="px-4 py-2">Cert Name</th>
              <th className="px-4 py-2">Requested At</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Reviewer</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No PDF requests.</td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{req.buyer_name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-700">{req.cert_name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {req.requested_at ? new Date(req.requested_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(req.status)}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{req.reviewer ?? '—'}</td>
                  <td className="px-4 py-2">
                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <a
                          href={`/api/pdf-requests/${req.id}/approve`}
                          className="px-2 py-0.5 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                        >
                          Approve
                        </a>
                        <a
                          href={`/api/pdf-requests/${req.id}/deny`}
                          className="px-2 py-0.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Deny
                        </a>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
