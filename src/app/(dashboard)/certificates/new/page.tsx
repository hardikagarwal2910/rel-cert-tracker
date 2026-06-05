import Link from 'next/link';
import { getCategories } from '@/lib/db/categories';
import { getLocations } from '@/lib/db/locations';
import CertForm from '../CertForm';

export default async function NewCertificatePage() {
  const [categories, locations] = await Promise.all([
    getCategories(true).catch(() => []),
    getLocations(true).catch(() => []),
  ]);

  return (
    <div>
      <Link href="/certificates" className="text-sm text-gray-500 hover:underline">← Certificates</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6" style={{ color: '#878687' }}>New Certificate</h1>
      <CertForm
        mode="create"
        categories={categories.map((c) => c.name)}
        locations={locations.map((l) => ({ id: l.id, name: l.name, nickname: l.nickname, city: l.city }))}
      />
    </div>
  );
}
