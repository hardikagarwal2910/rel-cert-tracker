import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { redirect } from 'next/navigation';
import { getSupplierById } from '@/lib/db/suppliers';
import { getSupplierCerts } from '@/lib/db/supplier-certs';

async function getSupplierIdFromCookie(): Promise<string | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('rel_supplier_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '');
    const { payload } = await jwtVerify(token, secret);
    return (payload.supplier_id as string) ?? null;
  } catch {
    return null;
  }
}

export default async function SupplierDashboardPage() {
  const supplierId = await getSupplierIdFromCookie();
  if (!supplierId) redirect('/supplier/login');

  const [supplier, certs] = await Promise.all([
    getSupplierById(supplierId).catch(() => null),
    getSupplierCerts(supplierId).catch(() => []),
  ]);

  if (!supplier) redirect('/supplier/login');

  const total = certs.length;
  const pending = certs.filter((c) => c.status === 'pending_review').length;
  const approved = certs.filter((c) => c.status === 'approved').length;
  const rejected = certs.filter((c) => c.status === 'rejected').length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#878687' }}>
        Welcome, {supplier.name}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Status: <span className="font-medium capitalize">{supplier.status}</span>
        {supplier.tier ? ` · Tier ${supplier.tier}` : ''}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm text-center">
          <p className="text-3xl font-bold text-gray-800">{total}</p>
          <p className="text-xs text-gray-500 mt-1">Total Submitted</p>
        </div>
        <div className="rounded-lg border border-yellow-200 p-4 bg-yellow-50 shadow-sm text-center">
          <p className="text-3xl font-bold text-yellow-700">{pending}</p>
          <p className="text-xs text-yellow-600 mt-1">Pending Review</p>
        </div>
        <div className="rounded-lg border border-green-200 p-4 bg-green-50 shadow-sm text-center">
          <p className="text-3xl font-bold text-green-700">{approved}</p>
          <p className="text-xs text-green-600 mt-1">Approved</p>
        </div>
        <div className="rounded-lg border border-red-200 p-4 bg-red-50 shadow-sm text-center">
          <p className="text-3xl font-bold text-red-700">{rejected}</p>
          <p className="text-xs text-red-600 mt-1">Rejected</p>
        </div>
      </div>
    </div>
  );
}
