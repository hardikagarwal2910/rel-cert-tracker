import { getSupplierById, getSupplierScorecard } from '@/lib/db/suppliers';
import { getCertificates } from '@/lib/db/certificates';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import SendInviteButton from './SendInviteButton';
import SupplierArchiveControl from './SupplierArchiveControl';

interface Props {
  params: { id: string };
}

export default async function SupplierDetailPage({ params }: Props) {
  const [supplier, scorecard, allCerts] = await Promise.all([
    getSupplierById(params.id).catch(() => null),
    getSupplierScorecard(params.id).catch(() => null),
    getCertificates().catch(() => []),
  ]);

  if (!supplier) notFound();

  const requiredCerts = allCerts.filter((c) =>
    supplier.required_cert_ids?.includes(c.id)
  );

  const cl = supplier.onboarding_checklist;
  const checklistItems: { label: string; done: boolean }[] = [
    { label: 'Contacts added', done: cl?.contacts_added ?? false },
    { label: 'Required certs defined', done: cl?.required_certs_defined ?? false },
    { label: 'Invite sent', done: cl?.invite_sent ?? false },
    { label: 'Invite accepted', done: cl?.invite_accepted ?? false },
    { label: 'First cert uploaded', done: cl?.first_cert_uploaded ?? false },
  ];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/suppliers" className="text-sm text-gray-500 hover:underline">← Suppliers</Link>
          <h1 className="text-2xl font-bold mt-1" style={{ color: '#878687' }}>{supplier.name}</h1>
          <p className="text-sm text-gray-500">
            {supplier.tier ? `Tier ${supplier.tier}` : ''} · {supplier.status}
            {supplier.city ? ` · ${supplier.city}, ${supplier.state}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SendInviteButton supplierId={supplier.id} />
          <SupplierArchiveControl supplierId={supplier.id} status={supplier.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Contacts */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Contacts</h2>
          {supplier.contacts?.length === 0 ? (
            <p className="text-sm text-gray-500">No contacts.</p>
          ) : (
            <ul className="space-y-2">
              {supplier.contacts?.map((c, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-gray-600">{c.email}</p>
                  {c.phone && <p className="text-gray-500">{c.phone}</p>}
                  {c.role && <p className="text-xs text-gray-400">{c.role}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Onboarding checklist */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Onboarding Checklist</h2>
          <ul className="space-y-2">
            {checklistItems.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                <span className={`w-4 h-4 rounded-full flex-shrink-0 ${item.done ? 'bg-green-500' : 'bg-gray-200'}`} />
                <span className={item.done ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Scorecard */}
      {scorecard && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Scorecard</h2>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-xl font-bold text-gray-800">{scorecard.total_submissions}</p>
              <p className="text-xs text-gray-500">Total Submissions</p>
            </div>
            <div>
              <p className="text-xl font-bold text-green-600">{scorecard.approved}</p>
              <p className="text-xs text-gray-500">Approved</p>
            </div>
            <div>
              <p className="text-xl font-bold text-red-600">{scorecard.rejected}</p>
              <p className="text-xs text-gray-500">Rejected</p>
            </div>
            {scorecard.compliance_rate != null && (
              <div>
                <p className="text-xl font-bold text-gray-800">
                  {(scorecard.compliance_rate * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">Compliance Rate</p>
              </div>
            )}
            {scorecard.on_time_rate != null && (
              <div>
                <p className="text-xl font-bold text-gray-800">
                  {(scorecard.on_time_rate * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">On-Time Rate</p>
              </div>
            )}
            {scorecard.combined_score != null && (
              <div>
                <p className="text-xl font-bold" style={{ color: '#878687' }}>
                  {(scorecard.combined_score * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">Combined Score</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Required certs */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Required Certificates</h2>
        {requiredCerts.length === 0 ? (
          <p className="text-sm text-gray-500">No required certificates defined.</p>
        ) : (
          <ul className="space-y-1">
            {requiredCerts.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <Link href={`/certificates/${c.id}`} className="text-gray-800 hover:underline">
                  {c.name}
                </Link>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  c.status === 'active' ? 'bg-green-100 text-green-800' :
                  c.status === 'expiring_soon' ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {c.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
