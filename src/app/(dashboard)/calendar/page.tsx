import { getCertificates } from '@/lib/db/certificates';
import CalendarClient from './CalendarClient';

export default async function CalendarPage() {
  const certs = await getCertificates().catch(() => []);

  // Pass only the fields the calendar needs.
  const items = certs.map((c) => ({
    id: c.id,
    name: c.name,
    issuing_body: c.issuing_body ?? null,
    expiry_date: c.expiry_date,
    status: c.status,
    submitted_by_supplier: c.submitted_by_supplier ?? false,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#878687' }}>
        Renewal Calendar
      </h1>
      <CalendarClient items={items} />
    </div>
  );
}
