import Link from 'next/link';
import { headers } from 'next/headers';
import { getSuppliers } from '@/lib/db/suppliers';
import SuppliersClient from './SuppliersClient';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams?: { inactive?: string };
}) {
  const isAdmin = headers().get('x-user-role') === 'admin';
  const showInactive = searchParams?.inactive === 'true';
  const suppliers = await getSuppliers(showInactive ? { includeInactive: true } : undefined).catch(() => []);

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded ${active ? 'font-medium text-gray-800 bg-gray-100' : 'text-gray-500 hover:text-gray-700'}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>Suppliers</h1>
        <div className="flex gap-2">
          <Link
            href="/bulk-import/suppliers"
            className="px-4 py-2 rounded text-sm font-medium border border-gray-300 hover:bg-gray-50"
            style={{ color: '#878687' }}
          >
            Bulk Onboard
          </Link>
          <Link
            href="/suppliers/new"
            className="px-4 py-2 rounded text-sm font-medium"
            style={{ backgroundColor: '#F5C400', color: '#333' }}
          >
            + New Supplier
          </Link>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        <Link href="/suppliers" className={tabCls(!showInactive)}>Active</Link>
        <Link href="/suppliers?inactive=true" className={tabCls(showInactive)}>All (incl. inactive)</Link>
      </div>

      <SuppliersClient suppliers={suppliers} isAdmin={isAdmin} />
    </div>
  );
}
