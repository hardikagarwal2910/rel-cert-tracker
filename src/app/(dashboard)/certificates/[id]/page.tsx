import { getCertificateById } from '@/lib/db/certificates';
import { getCertDocuments } from '@/lib/db/cert-documents';
import { getLocations } from '@/lib/db/locations';
import { notFound } from 'next/navigation';
import { differenceInCalendarDays } from 'date-fns';
import Link from 'next/link';
import BuyerVisibilityEditor from './BuyerVisibilityEditor';
import RenewalStageControl from './RenewalStageControl';
import CertArchiveControl from './CertArchiveControl';
import { locationLabel, locationAddressOneLine } from '@/lib/location-label';

const statusBadge = (status: string) => {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'expiring_soon') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
};

const DOC_TYPE_LABEL: Record<string, string> = {
  certificate: 'Certificate',
  test_report: 'Test Reports',
  scope_annex: 'Scope Annex',
  other: 'Other',
};

interface Props {
  params: { id: string };
}

export default async function CertDetailPage({ params }: Props) {
  const cert = await getCertificateById(params.id).catch(() => null);
  if (!cert) notFound();

  const [documents, locations] = await Promise.all([
    getCertDocuments(cert.id).catch(() => []),
    getLocations().catch(() => []),
  ]);
  const certLocation = cert.location_id
    ? locations.find((l) => l.id === cert.location_id) ?? null
    : null;

  const days = differenceInCalendarDays(new Date(cert.expiry_date), new Date());
  const daysLabel = days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`;
  const daysColor = days < 0 || days <= 7 ? '#dc2626' : days <= 30 ? '#f59e0b' : '#16a34a';

  // Group documents by type; ensure the primary cert PDF appears even if it
  // predates the cert_documents table (backward compatibility).
  const docGroups = new Map<string, { file_name: string; google_drive_file_id: string }[]>();
  for (const d of documents) {
    const arr = docGroups.get(d.doc_type) ?? [];
    arr.push({ file_name: d.file_name, google_drive_file_id: d.google_drive_file_id });
    docGroups.set(d.doc_type, arr);
  }
  if (cert.google_drive_file_id && !documents.some((d) => d.google_drive_file_id === cert.google_drive_file_id)) {
    const arr = docGroups.get('certificate') ?? [];
    arr.unshift({ file_name: 'current.pdf', google_drive_file_id: cert.google_drive_file_id });
    docGroups.set('certificate', arr);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/certificates" className="text-sm text-gray-500 hover:underline">← Certificates</Link>
          <h1 className="text-2xl font-bold mt-1" style={{ color: '#878687' }}>{cert.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/certificates/${cert.id}/edit`} className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Edit</Link>
          <Link href={`/certificates/${cert.id}/upload-pdf`} className="px-3 py-1.5 text-sm rounded font-medium" style={{ backgroundColor: '#F5C400', color: '#333' }}>Upload Document</Link>
          <CertArchiveControl certId={cert.id} archived={!!cert.archived} />
        </div>
      </div>

      {cert.archived && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-800">
          This certificate is <span className="font-semibold">archived</span> — hidden from the active list and
          all buyer views. Use <span className="font-medium">Restore</span> to bring it back (it stays
          buyer-invisible until you re-enable visibility).
        </div>
      )}

      {/* LEAD: status + next action */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(cert.status)}`}>{cert.status.replace('_', ' ')}</span>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Expiry</p>
            <p className="font-medium text-gray-800">{cert.expiry_date}</p>
            <p className="text-xs font-medium" style={{ color: daysColor }}>{daysLabel}</p>
          </div>
          <RenewalStageControl certId={cert.id} initial={cert.renewal_stage ?? 'not_started'} />
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Location</p>
            {certLocation ? (
              <>
                <Link href={`/locations/${certLocation.id}`} className="font-medium text-gray-800 hover:underline">
                  {locationLabel(certLocation)}
                </Link>
                <p className="text-xs text-gray-500 mt-0.5">{locationAddressOneLine(certLocation)}</p>
              </>
            ) : (
              <p className="font-medium text-gray-800">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Documents</h2>
          <Link href={`/certificates/${cert.id}/upload-pdf`} className="text-xs hover:underline" style={{ color: '#878687' }}>+ Add document</Link>
        </div>
        {docGroups.size === 0 ? (
          <p className="text-sm text-gray-500">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {Array.from(docGroups.entries()).map(([type, files]) => (
              <div key={type}>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{DOC_TYPE_LABEL[type] ?? type}</p>
                <ul className="space-y-1">
                  {files.map((f) => (
                    <li key={f.google_drive_file_id}>
                      <a href={`https://drive.google.com/file/d/${f.google_drive_file_id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {f.file_name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reference metadata (secondary) */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-gray-500 text-xs uppercase">Cert Number</p><p className="font-medium text-gray-800">{cert.cert_number ?? '—'}</p></div>
          <div><p className="text-gray-500 text-xs uppercase">Issuing Body</p><p className="font-medium text-gray-800">{cert.issuing_body ?? '—'}</p></div>
          <div><p className="text-gray-500 text-xs uppercase">Category</p><p className="font-medium text-gray-800">{cert.category ?? '—'}</p></div>
          <div><p className="text-gray-500 text-xs uppercase">Issue Date</p><p className="font-medium text-gray-800">{cert.issue_date ?? '—'}</p></div>
          <div><p className="text-gray-500 text-xs uppercase">Renewal Process Start</p><p className="font-medium text-gray-800">{cert.renewal_process_start_date ?? '—'}</p></div>
          <div><p className="text-gray-500 text-xs uppercase">Renewal Cost</p><p className="font-medium text-gray-800">{cert.renewal_cost != null ? `₹${cert.renewal_cost.toLocaleString('en-IN')}` : '—'}</p></div>
          <div><p className="text-gray-500 text-xs uppercase">Buyer Visible</p><p className="font-medium text-gray-800">{cert.buyer_visible ? 'Yes' : 'No'}</p></div>
          {cert.buyer_tags?.length > 0 && (
            <div className="col-span-2">
              <p className="text-gray-500 text-xs uppercase">Buyer Tags</p>
              <div className="flex gap-1 mt-1 flex-wrap">{cert.buyer_tags.map((t) => <span key={t} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{t}</span>)}</div>
            </div>
          )}
          {cert.notes && (
            <div className="col-span-2"><p className="text-gray-500 text-xs uppercase">Notes</p><p className="font-medium text-gray-800">{cert.notes}</p></div>
          )}
        </div>
      </div>

      <BuyerVisibilityEditor certId={cert.id} initialVisible={!!cert.buyer_visible} initialTags={cert.buyer_tags ?? []} />

      {/* Version history */}
      {cert.version_history?.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Version History</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                <th className="pb-2">Version</th><th className="pb-2">Expiry</th><th className="pb-2">Updated At</th><th className="pb-2">Updated By</th>
              </tr>
            </thead>
            <tbody>
              {cert.version_history.map((v) => (
                <tr key={v.version} className="border-t border-gray-100">
                  <td className="py-1.5 pr-4">v{v.version}</td>
                  <td className="py-1.5 pr-4">{v.expiry_date}</td>
                  <td className="py-1.5 pr-4">{new Date(v.updated_at).toLocaleDateString()}</td>
                  <td className="py-1.5">{v.updated_by ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
