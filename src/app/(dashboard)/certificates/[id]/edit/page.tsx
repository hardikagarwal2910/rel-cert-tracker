import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCertificateById } from '@/lib/db/certificates';
import { getCategories } from '@/lib/db/categories';
import { getLocations } from '@/lib/db/locations';
import CertForm from '../../CertForm';

interface Props {
  params: { id: string };
}

export default async function EditCertificatePage({ params }: Props) {
  const [cert, categories, locations] = await Promise.all([
    getCertificateById(params.id).catch(() => null),
    getCategories(true).catch(() => []),
    getLocations(true).catch(() => []),
  ]);
  if (!cert) notFound();

  return (
    <div>
      <Link href={`/certificates/${cert.id}`} className="text-sm text-gray-500 hover:underline">← {cert.name}</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6" style={{ color: '#878687' }}>Edit Certificate</h1>
      <CertForm
        mode="edit"
        certId={cert.id}
        categories={categories.map((c) => c.name)}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        initial={{
          name: cert.name,
          cert_number: cert.cert_number ?? '',
          issuing_body: cert.issuing_body ?? '',
          category: cert.category ?? '',
          issue_date: cert.issue_date ?? '',
          expiry_date: cert.expiry_date,
          renewal_process_start_date: cert.renewal_process_start_date ?? '',
          renewal_cost: cert.renewal_cost != null ? String(cert.renewal_cost) : '',
          location_id: cert.location_id ?? '',
          buyer_tags: (cert.buyer_tags ?? []).join(', '),
          buyer_visible: !!cert.buyer_visible,
          notes: cert.notes ?? '',
        }}
      />
    </div>
  );
}
