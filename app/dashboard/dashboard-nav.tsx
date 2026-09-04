'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/dashboard/net-worth', label: 'Activos y pasivos' },
  { href: '/dashboard/movements', label: 'Ingresos y gastos' },
  { href: '/dashboard/history', label: 'Histórico' },
  { href: '/dashboard/settings', label: 'Tasas de cambio' },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="dashboard-tabs" aria-label="Secciones financieras">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={pathname === link.href ? 'active' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
