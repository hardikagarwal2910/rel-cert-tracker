import Link from 'next/link';
import { getSuppliers } from '@/lib/db/suppliers';
import SuppliersClient from './SuppliersClient';

export default async function SuppliersPage() {
  const suppliers = await getSuppliers().catch(() => []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>Suppliers</h1>
        <Link
          href="/bulk-import/suppliers"
          className="px-4 py-2 rounded text-sm font-medium"
          style={{ backgroundColor: '#F5C400', color: '#333' }}
        >
          Bulk Onboard
        </Link>
      </div>
      <SuppliersClient suppliers={suppliers} />
    </div>
  );
}
