import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getPendingReviewQueue } from '@/lib/db/supplier-certs';
import Sidebar, { type NavLink } from './Sidebar';
import SearchBox from './SearchBox';
import SignOutButton from './SignOutButton';
import { APP_VERSION } from '@/lib/version';

const navLinks: NavLink[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/certificates', label: 'Certificates' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/bulk-import', label: 'Bulk Import', cap: 'BULK_IMPORT' },
  { href: '/locations', label: 'Locations' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/review-queue', label: 'Review Queue', badge: true },
  { href: '/pdf-requests', label: 'PDF Requests' },
  { href: '/buyer-activity', label: 'Buyer Activity', cap: 'MANAGE_BUYERS' },
  { href: '/renewal-workload', label: 'Renewal Workload' },
  { href: '/audit-pack', label: 'Audit Pack' },
  { href: '/users', label: 'Users', cap: 'MANAGE_USERS' },
  { href: '/audit-log', label: 'Audit Log', cap: 'VIEW_AUDIT_LOG' },
  { href: '/settings', label: 'Settings', cap: 'SETTINGS' },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware injects x-user-id / x-user-name headers for authenticated users.
  // If missing, the request wasn't authenticated — redirect to login.
  const headersList = headers();
  const userId = headersList.get('x-user-id');
  if (!userId) {
    redirect('/login');
  }

  const userName = headersList.get('x-user-name') ?? 'User';
  const userRole = headersList.get('x-user-role') ?? undefined;

  const pendingQueue = await getPendingReviewQueue().catch(() => []);
  const pendingCount = pendingQueue.length;

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <span className="text-lg font-bold" style={{ color: '#878687' }}>
            REL Cert Tracker
          </span>
        </div>
        <Sidebar links={navLinks} pendingCount={pendingCount} role={userRole} />
        <div className="p-4 border-t border-gray-200 space-y-2">
          <SignOutButton />
          <p className="text-[11px] text-gray-400">v{APP_VERSION}</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0 gap-4">
          <SearchBox />
          <span className="text-sm text-gray-600 flex-shrink-0">{userName}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
