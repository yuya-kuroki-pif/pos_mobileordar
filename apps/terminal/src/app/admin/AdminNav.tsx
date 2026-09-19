'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/menu', label: 'メニュー' },
  { href: '/admin/tables', label: '卓・QR' },
  { href: '/admin/sales', label: '売上' },
  { href: '/admin/settings', label: '店舗設定' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print border-b border-charcoal-100 bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {LINKS.map((link) => {
          // "/admin" は完全一致、それ以外は配下のページも含めて選択状態にする
          const active =
            link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                active
                  ? 'border-ember-500 text-ember-600'
                  : 'border-transparent text-charcoal-500 hover:text-charcoal-800'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
