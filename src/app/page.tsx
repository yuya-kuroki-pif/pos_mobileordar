import Link from 'next/link';

import { DemoBanner } from '@/components/DemoBanner';
import { SetupNotice } from '@/components/SetupNotice';
import { Card } from '@/components/ui';
import { getStoreBySlug, getTables } from '@/lib/queries';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * 各画面への入口。
 * 実運用では POS 端末・キッチン端末・客のスマホがそれぞれ別の URL を直接開くが、
 * 開発中や社内デモではここから辿れると確認が早い。
 */
export default async function HomePage() {
  if (!isSupabaseConfigured() && !isDemoMode()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <SetupNotice />
      </main>
    );
  }

  // デモ店舗の卓が 1 つでもあれば、モバイルオーダーの入口リンクを出す
  let demoToken: string | null = null;
  let storeName: string | null = null;
  try {
    const store = await getStoreBySlug('demo');
    if (store) {
      storeName = store.name;
      const tables = await getTables(store.id);
      demoToken = tables[0]?.qr_token ?? null;
    }
  } catch {
    // DB 未適用でもトップページは表示できるようにする
  }

  const entries = [
    {
      href: '/pos',
      title: 'POS レジ',
      description: 'フロアマップ・注文入力・会計。店舗スタッフが使う画面です。',
      tone: 'bg-ember-600',
      badge: '要ログイン',
    },
    {
      href: '/kds',
      title: 'キッチンディスプレイ',
      description: '入った注文を調理順に表示します。厨房の端末で開きます。',
      tone: 'bg-charcoal-800',
      badge: '要ログイン',
    },
    {
      href: '/admin',
      title: '管理ダッシュボード',
      description: 'メニュー・卓・QR コード・売上の管理。',
      tone: 'bg-sky-700',
      badge: '要ログイン',
    },
    demoToken
      ? {
          href: `/order/${demoToken}`,
          title: 'モバイルオーダー（デモ）',
          description: '客が QR を読み込んだときの画面。スマホで開くと実際の見え方が確認できます。',
          tone: 'bg-emerald-700',
          badge: 'ログイン不要',
        }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <>
      <DemoBanner />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
      <header className="mb-10">
        <p className="text-sm font-semibold tracking-wide text-ember-600">
          {storeName ?? 'セットアップ待ち'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          POS レジ + モバイルオーダー
        </h1>
        <p className="mt-3 max-w-2xl text-charcoal-500">
          卓の QR から客が自分で注文し、厨房のディスプレイに流れ、レジで会計する。
          その一連の流れを 1 つのシステムで扱います。
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <Link key={entry.href} href={entry.href} className="group">
            <Card className="h-full p-6 transition-shadow group-hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className={`h-10 w-10 rounded-xl ${entry.tone}`} />
                <span className="rounded-full bg-charcoal-100 px-2.5 py-0.5 text-xs font-semibold text-charcoal-500">
                  {entry.badge}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-bold text-charcoal-900">{entry.title}</h2>
              <p className="mt-1 text-sm text-charcoal-500">{entry.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      {!demoToken && (
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          デモ店舗のデータが見つかりません。<code>supabase/seed.sql</code> を実行すると
          メニューと卓のサンプルが入ります。
        </p>
        )}
      </main>
    </>
  );
}
