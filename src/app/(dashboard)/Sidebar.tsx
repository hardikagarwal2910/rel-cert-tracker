'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { can, type Capability } from '@/lib/auth/permissions';

export interface NavLink {
  href: string;
  label: string;
  badge?: boolean;
  // Nav item is shown only if the current role has this capability. Defaults to
  // VIEW_DATA (visible to every authenticated role, incl. viewer).
  cap?: Capability;
}

const YELLOW = '#F5C400';

export default function Sidebar({ links, pendingCount, role }: { links: NavLink[]; pendingCount: number; role?: string }) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const visibleLinks = links.filter((l) => can(role, l.cap ?? 'VIEW_DATA'));

  return (
    <nav className="flex-1 overflow-y-auto py-4">
      <ul className="space-y-1 px-2">
        {visibleLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors"
                style={
                  active
                    ? { backgroundColor: '#ededed', color: '#111827', fontWeight: 600 }
                    : { color: '#374151' }
                }
              >
                <span>{link.label}</span>
                {link.badge && pendingCount > 0 && (
                  <span
                    className="ml-2 inline-flex items-center justify-center rounded-full text-xs font-medium px-2 py-0.5"
                    style={{ backgroundColor: YELLOW, color: '#333' }}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
