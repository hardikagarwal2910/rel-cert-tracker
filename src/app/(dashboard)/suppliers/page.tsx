import { getSuppliers } from '@/lib/db/suppliers';
import SuppliersClient from './SuppliersClient';

export default async function SuppliersPage() {
  const suppliers = await getSuppliers().catch(() => []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>Suppliers</h1>
      </div>
      <SuppliersClient suppliers={suppliers} />
    </div>
  );
}
