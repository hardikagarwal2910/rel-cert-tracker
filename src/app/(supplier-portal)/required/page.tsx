import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { redirect } from 'next/navigation';
import { getSupplierById } from '@/lib/db/suppliers';
import { getSupplierCerts } from '@/lib/db/supplier-certs';
import { getCertificates } from '@/lib/db/certificates';

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

export default async function RequiredCertsPage() {
  const supplierId = await getSupplierIdFromCookie();
  if (!supplierId) redirect('/supplier/login');

  const [supplier, allCerts, supplierCerts] = await Promise.all([
    getSupplierById(supplierId).catch(() => null),
    getCertificates().catch(() => []),
    getSupplierCerts(supplierId).catch(() => []),
  ]);

  if (!supplier) redirect('/supplier/login');

  const requiredCerts = allCerts.filter((c) =>
    supplier.required_cert_ids?.includes(c.id)
  );

  const approvedCertNames = new Set(
    supplierCerts
      .filter((sc) => sc.status === 'approved')
      .map((sc) => sc.cert_name.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>Required Certificates</h1>

      {requiredCerts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
          <p className="text-sm text-gray-500">No required certificates have been defined for your account yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                <th className="px-4 py-2">Certificate Name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Issuing Body</th>
                <th className="px-4 py-2">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {requiredCerts.map((cert) => {
                const compliant = approvedCertNames.has(cert.name.toLowerCase());
                return (
                  <tr key={cert.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{cert.name}</td>
                    <td className="px-4 py-2 text-gray-600">{cert.category ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{cert.issuing_body ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        compliant ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {compliant ? 'Compliant' : 'Missing'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
