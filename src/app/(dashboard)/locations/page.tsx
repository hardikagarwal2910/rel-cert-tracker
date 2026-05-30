import { getLocations, getCertCountByLocation } from '@/lib/db/locations';
import AddLocationForm from './AddLocationForm';

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
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">City</th>
                  <th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">Certificates</th>
                  <th className="px-4 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No locations found.</td>
                  </tr>
                ) : (
                  locations.map((loc) => (
                    <tr key={loc.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{loc.name}</td>
                      <td className="px-4 py-2 text-gray-600">{loc.city}</td>
                      <td className="px-4 py-2 text-gray-600">{loc.state}</td>
                      <td className="px-4 py-2 text-gray-600">{countMap.get(loc.id) ?? 0}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${loc.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {loc.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <AddLocationForm />
        </div>
      </div>
    </div>
  );
}
