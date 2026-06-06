import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSupplierById } from '@/lib/db/suppliers';
import { getCertificates } from '@/lib/db/certificates';
import SupplierForm from '../../SupplierForm';

interface Props {
  params: { id: string };
}

export default async function EditSupplierPage({ params }: Props) {
  // Editing a supplier is admin-only (the API enforces 403; this matches the UI).
  if (headers().get('x-user-role') !== 'admin') redirect(`/suppliers/${params.id}`);

  const [supplier, certs] = await Promise.all([
    getSupplierById(params.id).catch(() => null),
    getCertificates().catch(() => []),
  ]);
  if (!supplier) notFound();

  return (
    <div>
      <Link href={`/suppliers/${supplier.id}`} className="text-sm text-gray-500 hover:underline">← {supplier.name}</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6" style={{ color: '#878687' }}>Edit Supplier</h1>
      <SupplierForm
        mode="edit"
        supplierId={supplier.id}
        certificates={certs.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          name: supplier.name,
          tier: (supplier.tier ?? '') as '' | '1' | '2' | '3',
          commodity_tags: (supplier.commodity_tags ?? []).join(', '),
          address_line_1: supplier.address_line_1 ?? '',
          address_line_2: supplier.address_line_2 ?? '',
          city: supplier.city ?? '',
          state: supplier.state ?? '',
          pincode: supplier.pincode ?? '',
          country: supplier.country ?? 'India',
          contacts: (supplier.contacts ?? []).map((c) => ({
            name: c.name ?? '',
            email: c.email ?? '',
            phone: c.phone ?? '',
            role: c.role ?? '',
          })),
          required_cert_ids: supplier.required_cert_ids ?? [],
        }}
      />
    </div>
  );
}
