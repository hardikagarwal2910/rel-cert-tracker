import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCertificates } from '@/lib/db/certificates';
import { can } from '@/lib/auth/permissions';
import SupplierForm from '../SupplierForm';

export default async function NewSupplierPage() {
  if (!can(headers().get('x-user-role'), 'ADD_ENTITY')) redirect('/suppliers');
  const certs = await getCertificates().catch(() => []);

  return (
    <div>
      <Link href="/suppliers" className="text-sm text-gray-500 hover:underline">← Suppliers</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6" style={{ color: '#878687' }}>New Supplier</h1>
      <SupplierForm mode="create" certificates={certs.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
