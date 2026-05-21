import Link from 'next/link';

const navLinks = [
  { href: '/supplier/dashboard', label: 'Dashboard' },
  { href: '/supplier/my-certs', label: 'My Certs' },
  { href: '/supplier/upload', label: 'Upload' },
  { href: '/supplier/required', label: 'Required' },
];

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="text-lg font-bold" style={{ color: '#878687' }}>
            REL Supplier Portal
          </span>
          <nav className="flex gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
