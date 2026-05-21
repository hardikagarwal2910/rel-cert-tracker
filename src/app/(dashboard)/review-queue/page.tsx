import { getPendingReviewQueue } from '@/lib/db/supplier-certs';
import Link from 'next/link';
import type { OcrResult } from '@/types/database';

export default async function ReviewQueuePage() {
  const queue = await getPendingReviewQueue().catch(() => []);

  const ocrBadge = (confidence: string | null) => {
    if (confidence === 'high') return 'bg-green-100 text-green-800';
    if (confidence === 'medium') return 'bg-amber-100 text-amber-800';
    if (confidence === 'low') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>
        Review Queue
        {queue.length > 0 && (
          <span
            className="ml-3 text-base px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: '#F5C400', color: '#333' }}
          >
            {queue.length}
          </span>
        )}
      </h1>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2">Cert Name</th>
              <th className="px-4 py-2">Submission Date</th>
              <th className="px-4 py-2">OCR Result</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Queue is empty.
                </td>
              </tr>
            ) : (
              queue.map((item) => {
                const ocr = item.ocr_result as OcrResult;
                const supplierName =
                  (item as unknown as { suppliers?: { name: string } }).suppliers?.name ?? item.supplier_id;
                return (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{supplierName}</td>
                    <td className="px-4 py-2 text-gray-700">{item.cert_name}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {item.submission_date
                        ? new Date(item.submission_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {ocr?.available ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ocrBadge(ocr.confidence)}`}>
                          {ocr.confidence ?? 'unknown'}
                          {ocr.flagged && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No OCR</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Link
                          href={`/api/supplier-certs/${item.id}?action=approve`}
                          className="px-2 py-0.5 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                        >
                          Approve
                        </Link>
                        <Link
                          href={`/api/supplier-certs/${item.id}?action=reject`}
                          className="px-2 py-0.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Reject
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
