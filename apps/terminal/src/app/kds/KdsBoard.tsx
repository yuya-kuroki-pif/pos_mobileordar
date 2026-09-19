'use client';

import { useMemo, useState, useTransition } from 'react';

import { updateItemStatus } from '@/lib/actions/order';
import { elapsedLabel, elapsedMinutes, formatTime } from '@/lib/format';
import type { KdsItem, PrepStation } from '@/lib/types';
import { useLiveData, useTicker } from '@/lib/useLiveData';

/** この分数を超えた注文を目立たせる。厨房で「遅れ」に気づける閾値 */
const WARN_MINUTES = 10;
const ALERT_MINUTES = 20;

type Filter = 'all' | PrepStation;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'kitchen', label: 'キッチン' },
  { key: 'bar', label: 'ドリンク' },
];

export function KdsBoard({ initialItems }: { initialItems: KdsItem[] }) {
  // 厨房は誰も操作していない時間が長いので、フロアマップより短い間隔で取り直す
  const { data: items, refresh, stale } = useLiveData<KdsItem[]>('/api/kds/items', initialItems, 4000);
  const now = useTicker(15_000);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.prep_station === filter)),
    [items, filter]
  );

  /**
   * 伝票（注文）単位のカードにまとめる。
   * 1 品ずつバラバラに出すより、同じ卓の品が並んでいる方が作る順番を決めやすい。
   */
  const tickets = useMemo(() => {
    const map = new Map<string, { key: string; items: KdsItem[] }>();
    for (const item of visible) {
      const entry = map.get(item.order_id) ?? { key: item.order_id, items: [] };
      entry.items.push(item);
      map.set(item.order_id, entry);
    }
    return [...map.values()].sort(
      (a, b) =>
        new Date(a.items[0].created_at).getTime() - new Date(b.items[0].created_at).getTime()
    );
  }, [visible]);

  const counts = useMemo(
    () => ({
      pending: items.filter((i) => i.status === 'pending').length,
      cooking: items.filter((i) => i.status === 'cooking').length,
      ready: items.filter((i) => i.status === 'ready').length,
    }),
    [items]
  );

  return (
    <main className="px-4 py-5">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="no-select inline-flex rounded-xl bg-charcoal-800 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-5 py-2 text-sm font-bold transition-colors ${
                filter === f.key ? 'bg-white text-charcoal-900' : 'text-charcoal-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-4 text-sm text-charcoal-300">
          <span>未調理 <b className="tabular text-white">{counts.pending}</b></span>
          <span>調理中 <b className="tabular text-white">{counts.cooking}</b></span>
          <span>提供待ち <b className="tabular text-white">{counts.ready}</b></span>
        </div>

        {stale && (
          <span className="ml-auto rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300">
            通信が不安定です
          </span>
        )}
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-charcoal-700 py-20 text-center text-charcoal-500">
          調理待ちの注文はありません
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tickets.map((ticket) => (
            <Ticket key={ticket.key} items={ticket.items} now={now} onChanged={refresh} />
          ))}
        </div>
      )}
    </main>
  );
}

function Ticket({
  items,
  now,
  onChanged,
}: {
  items: KdsItem[];
  now: number;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const head = items[0];
  const minutes = elapsedMinutes(head.created_at, now);

  // 経過時間で枠の色を変え、遅れている伝票が一目で分かるようにする
  const border =
    minutes >= ALERT_MINUTES
      ? 'border-red-500'
      : minutes >= WARN_MINUTES
        ? 'border-amber-400'
        : 'border-charcoal-700';

  function act(itemId: string, status: KdsItem['status']) {
    startTransition(async () => {
      await updateItemStatus(itemId, status);
      onChanged();
    });
  }

  /** 伝票内の未着手をまとめて調理中にする。1 品ずつ押す手間を省く */
  function startAll() {
    startTransition(async () => {
      await Promise.all(
        items.filter((i) => i.status === 'pending').map((i) => updateItemStatus(i.id, 'cooking'))
      );
      onChanged();
    });
  }

  return (
    <div className={`rounded-2xl border-2 bg-charcoal-800 ${border}`}>
      <div className="flex items-center gap-2 border-b border-charcoal-700 px-4 py-3">
        <span className="text-lg font-bold text-white">{head.table_name}</span>
        <span className="tabular text-xs text-charcoal-400">#{head.order_number}</span>
        {head.channel === 'mobile' && (
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300">
            モバイル
          </span>
        )}
        <span
          className={`tabular ml-auto text-sm font-bold ${
            minutes >= ALERT_MINUTES
              ? 'text-red-400'
              : minutes >= WARN_MINUTES
                ? 'text-amber-300'
                : 'text-charcoal-400'
          }`}
        >
          {elapsedLabel(head.created_at, now)}
        </span>
      </div>

      <ul className="divide-y divide-charcoal-700">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3">
            <div className="flex items-start gap-2">
              <span className="tabular shrink-0 rounded bg-charcoal-700 px-2 py-0.5 text-sm font-bold text-white">
                {item.quantity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug text-white">{item.name_snapshot}</p>
                {item.options_snapshot.length > 0 && (
                  <p className="text-xs text-charcoal-300">
                    {item.options_snapshot.map((o) => o.name).join(' / ')}
                  </p>
                )}
                {item.note && (
                  <p className="mt-1 rounded bg-ember-500/20 px-1.5 py-0.5 text-xs font-semibold text-ember-300">
                    {item.note}
                  </p>
                )}
              </div>
            </div>

            <div className="no-select mt-2 flex gap-2">
              {item.status === 'pending' && (
                <ActionButton disabled={pending} onClick={() => act(item.id, 'cooking')}>
                  調理開始
                </ActionButton>
              )}
              {item.status === 'cooking' && (
                <ActionButton disabled={pending} tone="ready" onClick={() => act(item.id, 'ready')}>
                  でき上がり
                </ActionButton>
              )}
              {item.status === 'ready' && (
                <ActionButton disabled={pending} tone="served" onClick={() => act(item.id, 'served')}>
                  提供した
                </ActionButton>
              )}
            </div>
          </li>
        ))}
      </ul>

      {items.some((i) => i.status === 'pending') && items.length > 1 && (
        <button
          type="button"
          disabled={pending}
          onClick={startAll}
          className="no-select w-full rounded-b-2xl border-t border-charcoal-700 py-2.5
            text-sm font-bold text-charcoal-300 transition-colors active:bg-charcoal-700"
        >
          この伝票をまとめて調理開始
        </button>
      )}

      <p className="px-4 pb-3 pt-1 text-[11px] text-charcoal-500">
        {formatTime(head.created_at)} 受注
      </p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = 'start',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'start' | 'ready' | 'served';
}) {
  const tones = {
    start: 'bg-sky-600 active:bg-sky-700',
    ready: 'bg-emerald-600 active:bg-emerald-700',
    served: 'bg-charcoal-600 active:bg-charcoal-500',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition-colors
        disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
