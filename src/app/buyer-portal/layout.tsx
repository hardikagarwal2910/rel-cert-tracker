import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getBuyerById } from '@/lib/db/buyers';
import BuyerLogout from './BuyerLogout';

export default async function BuyerPortalLayout({ children }: { children: React.ReactNode }) {
  const headersList = headers();
  const buyerId = headersList.get('x-buyer-id');
  if (!buyerId) {
    redirect('/buyer/login');
  }

  const buyer = await getBuyerById(buyerId).catch(() => null);
  const buyerName = buyer?.name ?? 'Buyer';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Distinct buyer-portal header: dark taupe band with a yellow rule */}
      <header style={{ backgroundColor: '#878687' }}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold" style={{ color: '#F5C400' }}>
              REL Compliance Portal
            </span>
            <span className="ml-3 text-xs text-white/80">Buyer Access</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/90">{buyerName}</span>
            <span className="bg-white/10 rounded px-2 py-1">
              <BuyerLogout />
            </span>
          </div>
        </div>
        <div style={{ height: '3px', backgroundColor: '#F5C400' }} />
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 flex gap-6">
          <Link href="/buyer-portal/certificates" className="py-3 text-sm text-gray-700 hover:text-gray-900">
            Certificates
          </Link>
          <Link href="/buyer-portal/certificates/by-location" className="py-3 text-sm text-gray-700 hover:text-gray-900">
            By Location
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
