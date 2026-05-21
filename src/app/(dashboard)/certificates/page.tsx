import { getCertificates } from '@/lib/db/certificates';
import { getCategories } from '@/lib/db/categories';
import CertFilterClient from './CertFilterClient';

export default async function CertificatesPage() {
  const [certs, categories] = await Promise.all([
    getCertificates().catch(() => []),
    getCategories(true).catch(() => []),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>
        Certificates
      </h1>
      <CertFilterClient certs={certs} categories={categories.map((c) => c.name)} />
    </div>
  );
}
