import Link from 'next/link';
import { getCertificates } from '@/lib/db/certificates';
import { getCategories } from '@/lib/db/categories';
import { getLocations } from '@/lib/db/locations';
import CertFilterClient from './CertFilterClient';

export default async function CertificatesPage() {
  const [certs, categories, locations] = await Promise.all([
    getCertificates().catch(() => []),
    getCategories(true).catch(() => []),
    getLocations().catch(() => []),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>
          Certificates
        </h1>
        <Link
          href="/certificates/new"
          className="px-4 py-2 rounded text-sm font-medium"
          style={{ backgroundColor: '#F5C400', color: '#333' }}
        >
          + New Certificate
        </Link>
      </div>
      <CertFilterClient
        certs={certs}
        categories={categories.map((c) => c.name)}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  );
}
