import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getLocationById, getCertCountByLocation } from '@/lib/db/locations';
import { locationAddressLines } from '@/lib/location-label';
import LocationForm from '../LocationForm';

interface Props {
  params: { id: string };
}

export default async function LocationDetailPage({ params }: Props) {
  // Staff can view full location details; only admins may edit.
  const isAdmin = headers().get('x-user-role') === 'admin';
  const [location, counts] = await Promise.all([
    getLocationById(params.id).catch(() => null),
    getCertCountByLocation().catch(() => []),
  ]);
  if (!location) notFound();

  const certCount = counts.find((c) => c.location_id === location.id)?.count ?? 0;
  const nick = location.nickname?.trim();
  const addressLines = locationAddressLines(location);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/locations" className="text-sm text-gray-500 hover:underline">← Locations</Link>
        <h1 className="text-2xl font-bold mt-1" style={{ color: '#878687' }}>
          {nick && nick.length > 0 ? nick : location.name}
        </h1>
        {nick && nick.length > 0 && <p className="text-sm text-gray-500">{location.name}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full details */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500 text-xs uppercase">Internal label / nickname</dt>
              <dd className="font-medium text-gray-800">{nick && nick.length > 0 ? nick : <span className="text-gray-400">— not set —</span>}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs uppercase">Company name</dt>
              <dd className="font-medium text-gray-800">{location.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs uppercase">Full address</dt>
              <dd className="font-medium text-gray-800">
                {addressLines.map((line, i) => <div key={i}>{line}</div>)}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-gray-500 text-xs uppercase">Status</dt>
                <dd>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${location.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {location.active ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs uppercase">Certificates using this location</dt>
                <dd className="font-medium text-gray-800">{certCount}</dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Edit form — admin only */}
        {isAdmin && (
          <div>
            <LocationForm
              mode="edit"
              locationId={location.id}
              initial={{
                nickname: location.nickname ?? '',
                name: location.name,
                address_line_1: location.address_line_1,
                address_line_2: location.address_line_2 ?? '',
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                country: location.country,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
