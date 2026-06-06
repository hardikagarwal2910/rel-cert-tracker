import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCategories } from '@/lib/db/categories';
import { getLocations } from '@/lib/db/locations';
import { can } from '@/lib/auth/permissions';
import CertForm from '../CertForm';

export default async function NewCertificatePage() {
  if (!can(headers().get('x-user-role'), 'ADD_ENTITY')) redirect('/certificates');
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
