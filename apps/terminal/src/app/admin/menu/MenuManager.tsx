'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Badge, Card, Empty, Input, PageHeader } from '@/components/ui';
import { toggleSoldOut } from '@/lib/actions/admin';
import { PREP_STATION_LABEL, formatYen } from '@/lib/format';
import type { Category, CategoryWithItems, MenuItem } from '@/lib/types';

/**
 * 店舗のメニュー状況。
 *
 * メニューの登録・編集・価格変更は業態単位の話なので、管理ダッシュボードが
 * 担当する（仕様書 §5.2〜§5.3）。ここに残しているのは、営業中に店舗が
 * 判断する「売切」の切り替えだけ（§5.13 の取扱メニュー一覧にあたる）。
 */
export function MenuManager({
  menu,
  uncategorized,
  dashboardUrl,
}: {
  menu: CategoryWithItems[];
  uncategorized: MenuItem[];
  dashboardUrl: string;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [pending, startTransition] = useTransition();

  const sections = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    const match = (items: MenuItem[]) =>
      needle ? items.filter((item) => item.name.toLowerCase().includes(needle)) : items;

    return [
      ...menu.map((category) => ({
        category: category as Category | null,
        items: match(category.items),
      })),
      ...(uncategorized.length > 0
        ? [{ category: null as Category | null, items: match(uncategorized) }]
        : []),
    ].filter((section) => section.items.length > 0);
  }, [menu, uncategorized, keyword]);

  function toggle(item: MenuItem) {
    startTransition(async () => {
      const result = await toggleSoldOut(item.id, !item.is_sold_out);
      if (!result.ok) alert(result.error ?? '切り替えられませんでした');
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="メニュー"
        description="売切の切り替えを行います。メニューの登録・価格変更は管理ダッシュボードから"
        actions={
          <a
            href={`${dashboardUrl}/menu`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-charcoal-200 bg-white px-4 py-2 text-sm font-semibold text-charcoal-600 hover:bg-charcoal-50"
          >
            ダッシュボードで編集 ↗
          </a>
        }
      />

      <div className="mb-5 max-w-sm">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="商品名で絞り込み"
        />
      </div>

      {sections.length === 0 && (
        <Empty
          title="表示できる商品がありません"
          description="管理ダッシュボードでメニューを登録し、この店舗の取扱を ON にしてください。"
        />
      )}

      <div className="space-y-6">
        {sections.map(({ category, items }) => (
          <Card key={category?.id ?? 'none'}>
            <div className="flex items-center gap-3 border-b border-charcoal-100 px-5 py-3">
              <h2 className="font-bold">{category?.name ?? 'カテゴリ未設定'}</h2>
              <span className="text-xs text-charcoal-400">{items.length} 品</span>
            </div>

            <ul className="divide-y divide-charcoal-50">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.name}</p>
                    {item.description && (
                      <p className="truncate text-xs text-charcoal-400">{item.description}</p>
                    )}
                  </div>

                  <Badge tone="neutral">{PREP_STATION_LABEL[item.prep_station]}</Badge>
                  <span className="tabular w-20 text-right font-semibold">
                    {formatYen(item.price)}
                  </span>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggle(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      item.is_sold_out
                        ? 'bg-red-100 text-red-700'
                        : 'bg-charcoal-100 text-charcoal-500'
                    }`}
                  >
                    {item.is_sold_out ? '売切中' : '販売中'}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
