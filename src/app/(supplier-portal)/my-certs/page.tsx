import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { redirect } from 'next/navigation';
import { getSupplierCerts } from '@/lib/db/supplier-certs';
import type { OcrResult } from '@/types/database';

async function getSupplierIdFromCookie(): Promise<string | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('rel_supplier_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '');
    const { payload } = await jwtVerify(token, secret);
    return (payload.supplier_id as string) ?? null;
  } catch {
    return null;
  }
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-600',
    expiring_soon: 'bg-amber-100 text-amber-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
};

const ocrBadge = (confidence: string | null) => {
  if (confidence === 'high') return 'bg-green-100 text-green-800';
  if (confidence === 'medium') return 'bg-amber-100 text-amber-800';
  if (confidence === 'low') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-600';
};

export default async function MycertsPage() {
  const supplierId = await getSupplierIdFromCookie();
  if (!supplierId) redirect('/supplier/login');

  const certs = await getSupplierCerts(supplierId).catch(() => []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>My Certificates</h1>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-4 py-2">Cert Name</th>
              <th className="px-4 py-2">Expiry Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Submission Date</th>
              <th className="px-4 py-2">OCR Confidence</th>
            </tr>
          </thead>
          <tbody>
            {certs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No certificates submitted yet.
                </td>
              </tr>
            ) : (
              certs.map((cert) => {
                const ocr = cert.ocr_result as OcrResult;
                return (
                  <tr key={cert.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{cert.cert_name}</td>
                    <td className="px-4 py-2 text-gray-600">{cert.expiry_date}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(cert.status)}`}>
                        {cert.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {cert.submission_date
                        ? new Date(cert.submission_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {ocr?.available ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ocrBadge(ocr.confidence)}`}>
                          {ocr.confidence ?? 'unknown'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
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
