import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getBuyerById, logBuyerVisit } from '@/lib/db/buyers';
import { getBuyerVisibleCertificates } from '@/lib/db/certificates';
import { getLocations } from '@/lib/db/locations';
import { locationLabel, locationAddressOneLine } from '@/lib/location-label';
import RequestPdfButton from '../../RequestPdfButton';
import type { Certificate, Location } from '@/types/database';

function statusBadge(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'expiring_soon') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

const UNASSIGNED = '__unassigned__';

export default async function BuyerByLocationPage() {
  const headersList = headers();
  const buyerId = headersList.get('x-buyer-id');
  if (!buyerId) redirect('/buyer/login');

  const buyer = await getBuyerById(buyerId);
  if (!buyer) redirect('/buyer/login');

  const [certs, locations] = await Promise.all([
    getBuyerVisibleCertificates(buyer.visible_tags ?? []),
    getLocations().catch(() => [] as Location[]),
  ]);
  const locMap = new Map(locations.map((l) => [l.id, l]));

  const ip = headersList.get('x-forwarded-for') ?? undefined;
  logBuyerVisit(buyerId, { ip, path: 'by-location' });

  // Group certs by location_id (Unassigned bucket for none).
  const groups = new Map<string, Certificate[]>();
  for (const c of certs) {
    const key = c.location_id && locMap.has(c.location_id) ? c.location_id : UNASSIGNED;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }

  const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    const la = locMap.get(a);
    const lb = locMap.get(b);
    return (la ? locationLabel(la) : '').localeCompare(lb ? locationLabel(lb) : '');
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#878687' }}>Certifications by Location</h1>
      <p className="text-sm text-gray-500 mb-6">REL compliance certificates grouped by site.</p>

      {certs.length === 0 && (
        <p className="text-sm text-gray-500">No certificates are currently available for your account.</p>
      )}

      {orderedKeys.map((key) => {
        const loc = key === UNASSIGNED ? null : locMap.get(key) ?? null;
        const rows = groups.get(key) ?? [];
        return (
          <div key={key} className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">
                {loc ? locationLabel(loc) : 'Unassigned'}
                <span className="text-gray-400 font-normal"> ({rows.length})</span>
              </h2>
              {loc && (
                <p className="text-xs text-gray-400 mt-0.5">{locationAddressOneLine(loc)}</p>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-4 py-2">Certificate</th>
                  <th className="px-4 py-2">Issuing Body</th>
                  <th className="px-4 py-2">Expiry</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-2 text-gray-600">{c.issuing_body ?? '—'}</td>
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
          </div>
        );
      })}
    </div>
  );
}
