import Link from 'next/link';
import { getCertificates } from '@/lib/db/certificates';
import { getCategories } from '@/lib/db/categories';
import { getLocations } from '@/lib/db/locations';
import CertFilterClient from './CertFilterClient';

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams?: { archived?: string };
}) {
  const archivedView = searchParams?.archived === 'true';

  const [certs, categories, locations] = await Promise.all([
    getCertificates(archivedView ? { archived: true } : undefined).catch(() => []),
    getCategories(true).catch(() => []),
    getLocations().catch(() => []),
  ]);

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded ${active ? 'font-medium text-gray-800 bg-gray-100' : 'text-gray-500 hover:text-gray-700'}`;

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

      <div className="flex gap-1 mb-4">
        <Link href="/certificates" className={tabCls(!archivedView)}>Active</Link>
        <Link href="/certificates?archived=true" className={tabCls(archivedView)}>Archived</Link>
      </div>

      <CertFilterClient
        certs={certs}
        categories={categories.map((c) => c.name)}
        locations={locations.map((l) => ({ id: l.id, name: l.name, nickname: l.nickname, city: l.city }))}
        archivedView={archivedView}
      />
    </div>
  );
}
