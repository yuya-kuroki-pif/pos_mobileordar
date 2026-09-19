'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Badge, Button, Card, Empty, Field, Input, PageHeader } from '@/components/ui';
import { deleteTable, regenerateQrToken, saveTable } from '@/lib/actions/admin';
import type { RestaurantTable } from '@/lib/types';

interface TableWithQr {
  table: RestaurantTable;
  url: string;
  qr: string;
}

export function TableManager({
  tables,
  storeName,
}: {
  tables: TableWithQr[];
  storeName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<RestaurantTable> | null>(null);
  const [view, setView] = useState<'list' | 'qr'>('list');
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) alert(result.error ?? '処理に失敗しました');
      router.refresh();
    });
  }

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="卓・QR 管理"
          description="卓を登録すると、その卓専用の QR コードが発行されます。"
          actions={
            <>
              <div className="inline-flex rounded-xl bg-charcoal-100 p-1">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold ${
                    view === 'list' ? 'bg-white shadow-sm' : 'text-charcoal-500'
                  }`}
                >
                  一覧
                </button>
                <button
                  type="button"
                  onClick={() => setView('qr')}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold ${
                    view === 'qr' ? 'bg-white shadow-sm' : 'text-charcoal-500'
                  }`}
                >
                  QR 印刷
                </button>
              </div>
              <Button onClick={() => setDraft({})}>卓を追加</Button>
            </>
          }
        />
      </div>

      {tables.length === 0 && (
        <Empty title="卓が登録されていません" description="「卓を追加」から登録してください。" />
      )}

      {view === 'list' ? (
        <Card className="no-print divide-y divide-charcoal-50">
          {tables.map(({ table, url }) => (
            <div key={table.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {table.name}
                  {table.area && (
                    <span className="ml-2 text-xs font-normal text-charcoal-400">
                      {table.area}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-charcoal-400">{url}</p>
              </div>

              <Badge tone="neutral">{table.seats} 席</Badge>
              {!table.is_active && <Badge tone="alert">利用しない</Badge>}

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(url);
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-charcoal-500 hover:bg-charcoal-100"
              >
                URL コピー
              </button>
              <button
                type="button"
                onClick={() => setDraft(table)}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-charcoal-500 hover:bg-charcoal-100"
              >
                編集
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (
                    confirm(
                      `${table.name} の QR を再発行しますか？\n印刷済みの QR コードは読み取れなくなります。`
                    )
                  ) {
                    act(() => regenerateQrToken(table.id));
                  }
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50"
              >
                QR 再発行
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm(`${table.name} を削除しますか？`)) act(() => deleteTable(table.id));
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
              >
                削除
              </button>
            </div>
          ))}
        </Card>
      ) : (
        <>
          <p className="no-print mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
            そのまま印刷すると、卓ごとの QR カードが 2 列で出力されます。
            卓上に置いてご利用ください。
          </p>
          <div className="print-grid grid grid-cols-2 gap-4 sm:grid-cols-3">
            {tables
              .filter(({ table }) => table.is_active)
              .map(({ table, qr }) => (
                <div
                  key={table.id}
                  className="print-card rounded-2xl border border-charcoal-200 bg-white p-5 text-center"
                >
                  <p className="text-xs text-charcoal-400">{storeName}</p>
                  <p className="mt-1 text-xl font-bold">{table.name}</p>
                  {/* data URL なので next/image は使わず img で出す */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt={`${table.name} の QR コード`} className="mx-auto mt-3 w-full max-w-[180px]" />
                  <p className="mt-2 text-sm font-semibold">QR を読み取ってご注文</p>
                  <p className="mt-0.5 text-[11px] text-charcoal-400">
                    カメラを起動してかざしてください
                  </p>
                </div>
              ))}
          </div>
          <div className="no-print mt-6">
            <Button variant="secondary" onClick={() => window.print()}>
              印刷する
            </Button>
          </div>
        </>
      )}

      {draft && (
        <TableDialog
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function TableDialog({
  draft,
  onClose,
  onSaved,
}: {
  draft: Partial<RestaurantTable>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveTable(formData);
      if (result.ok) onSaved();
      else setError(result.error ?? '保存できませんでした');
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-charcoal-900/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="border-b border-charcoal-100 px-6 py-4 text-lg font-bold">
          {draft.id ? '卓を編集' : '卓を追加'}
        </h2>

        <form action={submit} className="space-y-4 px-6 py-5">
          <input type="hidden" name="id" value={draft.id ?? ''} />

          <Field label="卓名" hint="例: A-1 / カウンター3 / 個室">
            <Input name="name" defaultValue={draft.name ?? ''} required autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="エリア" hint="1F / 2F など">
              <Input name="area" defaultValue={draft.area ?? ''} />
            </Field>
            <Field label="席数">
              <Input
                name="seats"
                type="number"
                min={1}
                defaultValue={draft.seats ?? 4}
                className="tabular text-right"
              />
            </Field>
          </div>

          <Field label="表示順" hint="小さいほど先頭">
            <Input
              name="sort_order"
              type="number"
              defaultValue={draft.sort_order ?? 0}
              className="tabular text-right"
            />
          </Field>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={draft.is_active ?? true}
              className="h-5 w-5 rounded border-charcoal-300 text-ember-600 focus:ring-ember-400"
            />
            <span className="text-sm font-medium text-charcoal-700">この卓を利用する</span>
          </label>

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
      </div>
    </div>
  );
}
