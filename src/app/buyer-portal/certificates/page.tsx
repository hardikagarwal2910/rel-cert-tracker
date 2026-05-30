import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getBuyerById, logBuyerVisit } from '@/lib/db/buyers';
import { getBuyerVisibleCertificates } from '@/lib/db/certificates';
import { getLocations } from '@/lib/db/locations';
import RequestPdfButton from '../RequestPdfButton';

function statusBadge(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'expiring_soon') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export default async function BuyerCertificatesPage() {
  const headersList = headers();
  const buyerId = headersList.get('x-buyer-id');
  if (!buyerId) redirect('/buyer/login');

  const buyer = await getBuyerById(buyerId);
  if (!buyer) redirect('/buyer/login');

  const [certs, locations] = await Promise.all([
    getBuyerVisibleCertificates(buyer.visible_tags ?? []),
    getLocations().catch(() => []),
  ]);
  const locMap = new Map(locations.map((l) => [l.id, l.name]));

  // Non-blocking visit log.
  const ip = headersList.get('x-forwarded-for') ?? undefined;
  logBuyerVisit(buyerId, { ip, path: 'certificates' });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#878687' }}>Certifications</h1>
      <p className="text-sm text-gray-500 mb-6">REL compliance certificates available to you.</p>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {certs.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No certificates are currently available for your account.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2">Certificate</th>
                <th className="px-4 py-2">Issuing Body</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Issued</th>
                <th className="px-4 py-2">Expiry</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-2 text-gray-600">{c.issuing_body ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{c.category ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{c.location_id ? locMap.get(c.location_id) ?? '—' : '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{c.issue_date ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{c.expiry_date}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(c.status)}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <RequestPdfButton
                      certId={c.id}
                      certName={c.name}
                      buyerName={buyer.name}
                      buyerCompany={buyer.company ?? ''}
                      buyerEmail={buyer.email}
                    />
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
