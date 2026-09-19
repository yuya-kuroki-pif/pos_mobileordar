'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui';
import { openTable } from '@/lib/actions/order';
import { SERVICE_TYPE_LABEL, elapsedLabel, formatYen } from '@/lib/format';
import type { ServiceType, TableWithSession } from '@/lib/types';
import { useLiveData, useTicker } from '@/lib/useLiveData';

export function FloorMap({ initialTables }: { initialTables: TableWithSession[] }) {
  const router = useRouter();
  const { data: tables, refresh, stale } = useLiveData<TableWithSession[]>(
    '/api/pos/floor',
    initialTables,
    5000
  );
  // 経過時間の表示だけを 30 秒ごとに進める
  const now = useTicker(30_000);

  const [opening, setOpening] = useState<TableWithSession | null>(null);

  // エリア（1F / 2F など）ごとに並べる。エリア未設定の卓は最後にまとめる
  const areas = useMemo(() => {
    const map = new Map<string, TableWithSession[]>();
    for (const table of tables) {
      const key = table.area ?? 'その他';
      map.set(key, [...(map.get(key) ?? []), table]);
    }
    return [...map.entries()];
  }, [tables]);

  const stats = useMemo(() => {
    const inUse = tables.filter((t) => t.session);
    return {
      inUse: inUse.length,
      total: tables.length,
      guests: inUse.reduce((sum, t) => sum + (t.session?.guest_count ?? 0), 0),
      sales: inUse.reduce((sum, t) => sum + t.current_total, 0),
      billRequested: inUse.filter((t) => t.session?.status === 'bill_requested').length,
    };
  }, [tables]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {/* 上部のサマリ */}
      <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Summary label="利用中" value={`${stats.inUse} / ${stats.total} 卓`} />
        <Summary label="在店人数" value={`${stats.guests} 名`} />
        <Summary label="現在の売上見込み" value={formatYen(stats.sales)} />
        {stats.billRequested > 0 && (
          <span className="rounded-full bg-ember-600 px-3 py-1 text-sm font-bold text-white">
            お会計希望 {stats.billRequested} 卓
          </span>
        )}
        {stale && (
          <span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            通信が不安定です（表示が最新でない可能性があります）
          </span>
        )}
      </div>

      {areas.map(([area, areaTables]) => (
        <section key={area} className="mb-8">
          <h2 className="mb-3 text-sm font-bold tracking-wide text-charcoal-400">{area}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {areaTables.map((table) => (
              <TableTile
                key={table.id}
                table={table}
                now={now}
                onOpen={() => setOpening(table)}
                onEnter={() => router.push(`/pos/session/${table.session!.id}`)}
              />
            ))}
          </div>
        </section>
      ))}

      {tables.length === 0 && (
        <p className="rounded-2xl border border-dashed border-charcoal-200 p-10 text-center text-charcoal-400">
          卓が登録されていません。管理画面から追加してください。
        </p>
      )}

      {opening && (
        <GuestCountDialog
          table={opening}
          onClose={() => setOpening(null)}
          onOpened={(sessionId) => {
            setOpening(null);
            refresh();
            router.push(`/pos/session/${sessionId}`);
          }}
        />
      )}
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-charcoal-400">{label}</p>
      <p className="tabular text-xl font-bold text-charcoal-900">{value}</p>
    </div>
  );
}

function TableTile({
  table,
  now,
  onOpen,
  onEnter,
}: {
  table: TableWithSession;
  now: number;
  onOpen: () => void;
  onEnter: () => void;
}) {
  const session = table.session;
  const billRequested = session?.status === 'bill_requested';

  // 空席 / 利用中 / 会計希望 を色で見分けられるようにする
  const tone = !session
    ? 'border-charcoal-200 bg-white hover:border-charcoal-300'
    : billRequested
      ? 'border-ember-500 bg-ember-50 hover:border-ember-600'
      : 'border-charcoal-800 bg-charcoal-800 text-white hover:border-charcoal-700';

  return (
    <button
      type="button"
      onClick={session ? onEnter : onOpen}
      className={`no-select flex h-36 flex-col items-start rounded-2xl border-2 p-4 text-left
        transition-colors ${tone}`}
    >
      <div className="flex w-full items-start justify-between">
        <span className="text-lg font-bold">{table.name}</span>
        {billRequested && (
          <span className="rounded-full bg-ember-600 px-2 py-0.5 text-[11px] font-bold text-white">
            会計希望
          </span>
        )}
        {session && !billRequested && table.pending_count > 0 && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-charcoal-900">
            未提供 {table.pending_count}
          </span>
        )}
      </div>

      {session ? (
        <>
          <p
            className={`mt-1 text-xs ${billRequested ? 'text-ember-700' : 'text-charcoal-300'}`}
          >
            {session.guest_count}名 ・ {elapsedLabel(session.opened_at, now)}経過
          </p>
          <p className="tabular mt-auto text-2xl font-bold">{formatYen(table.current_total)}</p>
          <p className={`text-xs ${billRequested ? 'text-ember-700' : 'text-charcoal-400'}`}>
            {table.item_count} 品
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-charcoal-400">{table.seats} 席</p>
          <span className="mt-auto text-sm font-semibold text-charcoal-400">＋ 卓を開ける</span>
        </>
      )}
    </button>
  );
}

/** 卓を開けるときに人数を聞くダイアログ */
function GuestCountDialog({
  table,
  onClose,
  onOpened,
}: {
  table: TableWithSession;
  onClose: () => void;
  onOpened: (sessionId: string) => void;
}) {
  const [count, setCount] = useState(Math.min(2, table.seats));
  const [serviceType, setServiceType] = useState<ServiceType>('eat_in');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await openTable(table.id, count, serviceType);
      if (result.ok && result.id) onOpened(result.id);
      else setError(result.error ?? '卓を開けませんでした。');
    });
  }

  // 席数 +4 まで選べるようにする（相席や詰めて座る場合があるため）
  const choices = Array.from({ length: table.seats + 4 }, (_, i) => i + 1);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-charcoal-900/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{table.name} を開ける</h2>

        {/* 提供形態。持ち帰りだと飲食料品が軽減税率 8% になる */}
        <div className="no-select mt-4">
          <p className="mb-2 text-sm text-charcoal-500">提供形態</p>
          <div className="grid grid-cols-2 gap-2">
            {(['eat_in', 'takeout'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setServiceType(type)}
                className={`rounded-xl border-2 py-3 text-sm font-bold transition-colors ${
                  serviceType === type
                    ? 'border-ember-500 bg-ember-50 text-ember-700'
                    : 'border-charcoal-100 bg-white text-charcoal-600'
                }`}
              >
                {SERVICE_TYPE_LABEL[type]}
                {type === 'takeout' && (
                  <span className="mt-0.5 block text-[11px] font-normal">軽減税率 8%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm text-charcoal-500">人数を選んでください</p>

        <div className="no-select mt-2 grid grid-cols-4 gap-2">
          {choices.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`rounded-xl py-3 text-lg font-bold transition-colors ${
                n === count
                  ? 'bg-ember-600 text-white'
                  : 'bg-charcoal-100 text-charcoal-700 active:bg-charcoal-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            キャンセル
          </Button>
          <Button size="lg" className="flex-1" onClick={submit} disabled={pending}>
            {pending ? '処理中…' : `${count}名で開ける`}
          </Button>
        </div>
      </div>
    </div>
  );
}
