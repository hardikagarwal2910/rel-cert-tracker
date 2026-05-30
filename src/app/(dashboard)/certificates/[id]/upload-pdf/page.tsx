import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCertificateById } from '@/lib/db/certificates';
import UploadPdfClient from './UploadPdfClient';

interface Props {
  params: { id: string };
}

export default async function UploadPdfPage({ params }: Props) {
  const cert = await getCertificateById(params.id).catch(() => null);
  if (!cert) notFound();

  return (
    <div>
      <Link href={`/certificates/${cert.id}`} className="text-sm text-gray-500 hover:underline">← {cert.name}</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6" style={{ color: '#878687' }}>Upload Document</h1>
      <UploadPdfClient certId={cert.id} />
    </div>
  );
}
