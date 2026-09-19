import Link from 'next/link';

import { logoutAction } from '@/lib/actions/auth';

import { DemoBanner } from './DemoBanner';

/** スタッフ向け画面（POS / KDS / 管理）に共通のヘッダー */
export function StaffNav({
  storeName,
  current,
  tone = 'light',
}: {
  storeName: string;
  current: 'pos' | 'kds' | 'admin';
  /** KDS は暗い画面なので配色を切り替える */
  tone?: 'light' | 'dark';
}) {
  const links = [
    { key: 'pos', href: '/pos', label: 'レジ' },
    { key: 'kds', href: '/kds', label: 'キッチン' },
    { key: 'admin', href: '/admin', label: '管理' },
  ] as const;

  const dark = tone === 'dark';

  return (
    <>
    <DemoBanner />
    <header
      className={`no-select sticky top-0 z-20 flex items-center gap-4 border-b px-4 py-3
        ${dark ? 'border-charcoal-700 bg-charcoal-900' : 'border-charcoal-100 bg-white'}`}
    >
      <span className={`shrink-0 font-bold ${dark ? 'text-white' : 'text-charcoal-900'}`}>
        {storeName}
      </span>

      <nav className="flex items-center gap-1">
        {links.map((link) => {
          const active = link.key === current;
          return (
            <Link
              key={link.key}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? dark
                    ? 'bg-charcoal-700 text-white'
                    : 'bg-charcoal-900 text-white'
                  : dark
                    ? 'text-charcoal-300 hover:bg-charcoal-800'
                    : 'text-charcoal-500 hover:bg-charcoal-100'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <form action={logoutAction} className="ml-auto">
        <button
          type="submit"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            dark
              ? 'text-charcoal-400 hover:bg-charcoal-800'
              : 'text-charcoal-400 hover:bg-charcoal-100'
          }`}
        >
          ログアウト
        </button>
      </form>
    </header>
    </>
  );
}
