import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/my-certs', label: 'My Certs' },
  { href: '/upload', label: 'Upload' },
  { href: '/required', label: 'Required' },
];

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Distinct supplier-portal header: white bar with a blue accent rule */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold" style={{ color: '#878687' }}>REL Supplier Portal</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>SUPPLIER</span>
          </div>
          <nav className="flex gap-4">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ height: '3px', backgroundColor: '#1e40af' }} />
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">{children}</main>

      <footer className="border-t border-gray-200 py-3 text-center">
        <p className="text-[11px] text-gray-400">REL Supplier Portal · v{APP_VERSION}</p>
      </footer>
    </div>
  );
}
