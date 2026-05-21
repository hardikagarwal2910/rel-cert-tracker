import { redirect } from 'next/navigation';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getPendingReviewQueue } from '@/lib/db/supplier-certs';

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/certificates', label: 'Certificates' },
  { href: '/locations', label: 'Locations' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/review-queue', label: 'Review Queue', badge: true },
  { href: '/pdf-requests', label: 'PDF Requests' },
  { href: '/audit-pack', label: 'Audit Pack' },
  { href: '/users', label: 'Users' },
  { href: '/audit-log', label: 'Audit Log' },
  { href: '/settings', label: 'Settings' },
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
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center justify-between px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                >
                  <span>{link.label}</span>
                  {link.badge && pendingCount > 0 && (
                    <span
                      className="ml-2 inline-flex items-center justify-center rounded-full text-xs font-medium px-2 py-0.5"
                      style={{ backgroundColor: '#F5C400', color: '#333' }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-700 w-full text-left"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-base font-semibold" style={{ color: '#878687' }}>
            REL Cert Tracker
          </span>
          <span className="text-sm text-gray-600">{userName}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
