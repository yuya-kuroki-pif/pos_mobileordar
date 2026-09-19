'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Badge, Button, Card, Empty, Field, Input, PageHeader } from '@/components/ui';
import {
  deleteCategory,
  deleteMenuItem,
  saveCategory,
  saveMenuItem,
  toggleSoldOut,
} from '@/lib/actions/admin';
import { PREP_STATION_LABEL, formatYen } from '@/lib/format';
import type { Category, CategoryWithItems, MenuItem, PrepStation } from '@/lib/types';

type ItemDraft = Partial<MenuItem> & { category_id?: string | null };

export function MenuManager({
  menu,
  uncategorized,
}: {
  menu: CategoryWithItems[];
  uncategorized: MenuItem[];
}) {
  const router = useRouter();
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<Partial<Category> | null>(null);
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) alert(result.error ?? '処理に失敗しました');
      router.refresh();
    });
  }

  const sections = [
    ...menu.map((category) => ({ category, items: category.items as MenuItem[] })),
    ...(uncategorized.length > 0
      ? [{ category: null as Category | null, items: uncategorized }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="メニュー管理"
        description="カテゴリと商品を登録します。売切の切り替えはここから即座に反映されます。"
        actions={
          <>
            <Button variant="secondary" onClick={() => setCategoryDraft({})}>
              カテゴリを追加
            </Button>
            <Button onClick={() => setItemDraft({ category_id: menu[0]?.id ?? null })}>
              商品を追加
            </Button>
          </>
        }
      />

      {sections.length === 0 && (
        <Empty
          title="カテゴリがありません"
          description="「カテゴリを追加」から、串焼き・ドリンクなどの区分を作ってください。"
        />
      )}

      <div className="space-y-6">
        {sections.map(({ category, items }) => (
          <Card key={category?.id ?? 'none'}>
            <div className="flex items-center gap-3 border-b border-charcoal-100 px-5 py-3">
              <h2 className="font-bold">{category?.name ?? 'カテゴリ未設定'}</h2>
              {category && !category.is_active && <Badge tone="neutral">非表示</Badge>}
              <span className="text-xs text-charcoal-400">{items.length} 品</span>

              {category && (
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => setCategoryDraft(category)}
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold text-charcoal-500 hover:bg-charcoal-100"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`カテゴリ「${category.name}」を削除しますか？\n配下の商品は「カテゴリ未設定」に移動します。`)) {
                        act(() => deleteCategory(category.id));
                      }
                    }}
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-charcoal-400">商品がありません</p>
            ) : (
              <ul className="divide-y divide-charcoal-50">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {item.name}
                        {!item.is_available && (
                          <span className="ml-2 text-xs font-normal text-charcoal-400">
                            （非公開）
                          </span>
                        )}
                      </p>
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
                      onClick={() => act(() => toggleSoldOut(item.id, !item.is_sold_out))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                        item.is_sold_out
                          ? 'bg-red-100 text-red-700'
                          : 'bg-charcoal-100 text-charcoal-500'
                      }`}
                    >
                      {item.is_sold_out ? '売切中' : '販売中'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setItemDraft(item)}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-charcoal-500 hover:bg-charcoal-100"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`「${item.name}」を削除しますか？\n過去の伝票には影響しません。`)) {
                          act(() => deleteMenuItem(item.id));
                        }
                      }}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {itemDraft && (
        <ItemDialog
          draft={itemDraft}
          categories={menu}
          onClose={() => setItemDraft(null)}
          onSaved={() => {
            setItemDraft(null);
            router.refresh();
          }}
        />
      )}

      {categoryDraft && (
        <CategoryDialog
          draft={categoryDraft}
          onClose={() => setCategoryDraft(null)}
          onSaved={() => {
            setCategoryDraft(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-charcoal-900/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="border-b border-charcoal-100 px-6 py-4 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const STATIONS: PrepStation[] = ['kitchen', 'bar', 'none'];

function ItemDialog({
  draft,
  categories,
  onClose,
  onSaved,
}: {
  draft: ItemDraft;
  categories: CategoryWithItems[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveMenuItem(formData);
      if (result.ok) onSaved();
      else setError(result.error ?? '保存できませんでした');
    });
  }

  return (
    <Dialog title={draft.id ? '商品を編集' : '商品を追加'} onClose={onClose}>
      <form action={submit} className="space-y-4 px-6 py-5">
        <input type="hidden" name="id" value={draft.id ?? ''} />

        <Field label="商品名">
          <Input name="name" defaultValue={draft.name ?? ''} required autoFocus />
        </Field>

        <Field label="説明" hint="メニューに表示される補足です（任意）">
          <Input name="description" defaultValue={draft.description ?? ''} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="価格（税込・円）">
            <Input
              name="price"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={draft.price ?? 0}
              required
              className="tabular text-right"
            />
          </Field>

          <Field label="表示順" hint="小さいほど先頭">
            <Input
              name="sort_order"
              type="number"
              defaultValue={draft.sort_order ?? 0}
              className="tabular text-right"
            />
          </Field>
        </div>

        <Field label="カテゴリ">
          <select
            name="category_id"
            defaultValue={draft.category_id ?? ''}
            className="w-full rounded-xl border border-charcoal-200 bg-white px-3 py-2.5 outline-none focus:border-ember-400"
          >
            <option value="">未設定</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="調理担当" hint="キッチンディスプレイのタブ振り分けに使います">
          <select
            name="prep_station"
            defaultValue={draft.prep_station ?? 'kitchen'}
            className="w-full rounded-xl border border-charcoal-200 bg-white px-3 py-2.5 outline-none focus:border-ember-400"
          >
            {STATIONS.map((station) => (
              <option key={station} value={station}>
                {PREP_STATION_LABEL[station]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="画像 URL" hint="任意。モバイルオーダーにサムネイルとして表示されます">
          <Input name="image_url" type="url" defaultValue={draft.image_url ?? ''} />
        </Field>

        <div className="space-y-2">
          <Checkbox name="is_available" defaultChecked={draft.is_available ?? true}>
            メニューに表示する
          </Checkbox>
          <Checkbox name="is_sold_out" defaultChecked={draft.is_sold_out ?? false}>
            本日売切
          </Checkbox>
          <Checkbox
            name="reduced_rate_eligible"
            defaultChecked={draft.reduced_rate_eligible ?? true}
          >
            持ち帰りなら軽減税率 8%
          </Checkbox>
          <p className="pl-7 text-xs text-charcoal-400">
            酒類・非飲食料品はチェックを外してください。持ち帰りでも標準税率になります。
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CategoryDialog({
  draft,
  onClose,
  onSaved,
}: {
  draft: Partial<Category>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveCategory(formData);
      if (result.ok) onSaved();
      else setError(result.error ?? '保存できませんでした');
    });
  }

  return (
    <Dialog title={draft.id ? 'カテゴリを編集' : 'カテゴリを追加'} onClose={onClose}>
      <form action={submit} className="space-y-4 px-6 py-5">
        <input type="hidden" name="id" value={draft.id ?? ''} />

        <Field label="カテゴリ名">
          <Input name="name" defaultValue={draft.name ?? ''} required autoFocus />
        </Field>

        <Field label="説明">
          <Input name="description" defaultValue={draft.description ?? ''} />
        </Field>

        <Field label="表示順" hint="小さいほど先頭">
          <Input
            name="sort_order"
            type="number"
            defaultValue={draft.sort_order ?? 0}
            className="tabular text-right"
          />
        </Field>

        <Checkbox name="is_active" defaultChecked={draft.is_active ?? true}>
          メニューに表示する
        </Checkbox>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Checkbox({
  name,
  defaultChecked,
  children,
}: {
  name: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-5 w-5 rounded border-charcoal-300 text-ember-600 focus:ring-ember-400"
      />
      <span className="text-sm font-medium text-charcoal-700">{children}</span>
    </label>
  );
}
