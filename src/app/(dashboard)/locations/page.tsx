import Link from 'next/link';
import { getLocations, getCertCountByLocation } from '@/lib/db/locations';
import { locationAddressOneLine } from '@/lib/location-label';
import LocationForm from './LocationForm';
import LocationActiveControl from './LocationActiveControl';

export default async function LocationsPage() {
  const [locations, counts] = await Promise.all([
    getLocations().catch(() => []),
    getCertCountByLocation().catch(() => []),
  ]);
  const countMap = new Map(counts.map((c) => [c.location_id, c.count]));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>
        Locations
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                  <th className="px-4 py-2">Nickname / Label</th>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Address</th>
                  <th className="px-4 py-2">Certificates</th>
                  <th className="px-4 py-2">Active</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No locations found.</td>
                  </tr>
                ) : (
                  locations.map((loc) => {
                    const nick = loc.nickname?.trim();
                    return (
                      <tr key={loc.id} className="border-t border-gray-100 hover:bg-gray-50 align-top">
                        <td className="px-4 py-2">
                          <Link href={`/locations/${loc.id}`} className="font-medium text-gray-800 hover:underline">
                            {nick && nick.length > 0 ? nick : <span className="text-gray-400 italic">{loc.name} (no nickname)</span>}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{loc.name}</td>
                        <td className="px-4 py-2 text-gray-600">{locationAddressOneLine(loc)}</td>
                        <td className="px-4 py-2 text-gray-600">{countMap.get(loc.id) ?? 0}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${loc.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {loc.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <Link href={`/locations/${loc.id}`} className="text-xs px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 mr-2">View / Edit</Link>
                          <LocationActiveControl locationId={loc.id} active={loc.active} certCount={countMap.get(loc.id) ?? 0} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <LocationForm mode="create" />
        </div>
      </div>
    </div>
  );
}
