'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { OptionDialog } from '@/components/OptionDialog';
import { Button } from '@/components/ui';
import {
  mergeSessions,
  moveSession,
  placePosOrder,
  updateItemQuantity,
  updateItemStatus,
  updateServiceType,
} from '@/lib/actions/order';
import {
  ORDER_ITEM_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  formatTaxRate,
  formatTime,
  formatYen,
} from '@/lib/format';
import type {
  CategoryWithItems,
  MenuItemWithOptions,
  Order,
  OrderItem,
  ServiceType,
  SessionTotal,
  Store,
  TableSession,
  ShopPaymentMethod,
} from '@/lib/types';
import { buildCartLine, lineTotal, useCart } from '@/lib/useCart';
import { useLiveData } from '@/lib/useLiveData';

import { CheckoutDialog } from './CheckoutDialog';

interface LiveData {
  session: TableSession;
  items: OrderItem[];
  total: SessionTotal;
}

export interface TableOption {
  id: string;
  name: string;
  area: string | null;
}

export interface SessionOption {
  sessionId: string;
  tableName: string;
  total: number;
}

export function SessionView({
  sessionId,
  initialSession,
  initialItems,
  orders,
  initialTotal,
  menu,
  store,
  paymentMethods,
  emptyTables,
  otherSessions,
  readOnly,
}: {
  sessionId: string;
  initialSession: TableSession;
  initialItems: OrderItem[];
  orders: Order[];
  initialTotal: SessionTotal;
  menu: CategoryWithItems[];
  store: Store;
  paymentMethods: ShopPaymentMethod[];
  emptyTables: TableOption[];
  otherSessions: SessionOption[];
  readOnly: boolean;
}) {
  const [tab, setTab] = useState<'bill' | 'order'>('bill');
  const [checkingOut, setCheckingOut] = useState(false);
  const [moving, setMoving] = useState(false);
  const [merging, setMerging] = useState(false);

  const { data, refresh } = useLiveData<LiveData>(
    `/api/pos/session/${sessionId}`,
    { session: initialSession, items: initialItems, total: initialTotal },
    // 伝票はフロアマップほど頻繁に変わらないので少し長めの間隔にする
    6000
  );

  const unpaidItems = useMemo(
    () => data.items.filter((item) => item.payment_id === null && item.status !== 'cancelled'),
    [data.items]
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      {!readOnly && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="no-select inline-flex rounded-xl bg-charcoal-100 p-1">
            <TabButton active={tab === 'bill'} onClick={() => setTab('bill')}>
              伝票
            </TabButton>
            <TabButton active={tab === 'order'} onClick={() => setTab('order')}>
              注文入力
            </TabButton>
          </div>

          <ServiceTypeToggle
            sessionId={sessionId}
            current={data.session.service_type}
            onChanged={refresh}
          />

          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMoving(true)}>
              卓移動
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMerging(true)}>
              伝票結合
            </Button>
          </div>
        </div>
      )}

      {tab === 'bill' ? (
        <BillView
          items={data.items}
          orders={orders}
          total={data.total}
          store={store}
          readOnly={readOnly}
          onChanged={refresh}
          onCheckout={() => setCheckingOut(true)}
        />
      ) : (
        <OrderEntry
          sessionId={sessionId}
          menu={menu}
          serviceType={data.session.service_type}
          onPlaced={() => {
            refresh();
            setTab('bill');
          }}
        />
      )}

      {checkingOut && (
        <CheckoutDialog
          sessionId={sessionId}
          store={store}
          unpaidItems={unpaidItems}
          paymentMethods={paymentMethods}
          onClose={() => setCheckingOut(false)}
          onPartialPaid={refresh}
        />
      )}

      {moving && (
        <MoveDialog
          sessionId={sessionId}
          tables={emptyTables}
          onClose={() => setMoving(false)}
        />
      )}

      {merging && (
        <MergeDialog
          sessionId={sessionId}
          sessions={otherSessions}
          onClose={() => setMerging(false)}
        />
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-6 py-2 text-sm font-bold transition-colors ${
        active ? 'bg-white text-charcoal-900 shadow-sm' : 'text-charcoal-500'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 店内 / 持ち帰りの切り替え。
 * これ以降の注文に適用される（すでに通した注文の税率は変えない）。
 */
function ServiceTypeToggle({
  sessionId,
  current,
  onChanged,
}: {
  sessionId: string;
  current: ServiceType;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function change(next: ServiceType) {
    if (next === current) return;
    startTransition(async () => {
      const result = await updateServiceType(sessionId, next);
      if (!result.ok) alert(result.error ?? '変更できませんでした');
      onChanged();
    });
  }

  return (
    <div className="no-select inline-flex items-center gap-2">
      <span className="text-xs font-semibold text-charcoal-400">提供形態</span>
      <div className="inline-flex rounded-xl bg-charcoal-100 p-1">
        {(['eat_in', 'takeout'] as const).map((type) => (
          <button
            key={type}
            type="button"
            disabled={pending}
            onClick={() => change(type)}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${
              current === type ? 'bg-white text-charcoal-900 shadow-sm' : 'text-charcoal-500'
            }`}
          >
            {SERVICE_TYPE_LABEL[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 伝票
// ---------------------------------------------------------------------------

function BillView({
  items,
  orders,
  total,
  store,
  readOnly,
  onChanged,
  onCheckout,
}: {
  items: OrderItem[];
  orders: Order[];
  total: SessionTotal;
  store: Store;
  readOnly: boolean;
  onChanged: () => void;
  onCheckout: () => void;
}) {
  const [pending, startTransition] = useTransition();

  // 注文（伝票）単位でまとめて表示する。同じタイミングで通った品が並ぶ方が確認しやすい
  const grouped = useMemo(() => {
    const byOrder = new Map<string, OrderItem[]>();
    for (const item of items) {
      byOrder.set(item.order_id, [...(byOrder.get(item.order_id) ?? []), item]);
    }
    return orders
      .map((order) => ({ order, items: byOrder.get(order.id) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [items, orders]);

  const paidCount = items.filter((i) => i.payment_id !== null).length;

  function act(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      onChanged();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {grouped.length === 0 && (
          <p className="rounded-2xl border border-dashed border-charcoal-200 bg-white p-10 text-center text-charcoal-400">
            まだ注文がありません
          </p>
        )}

        {grouped.map(({ order, items: orderItems }) => (
          <div key={order.id} className="rounded-2xl border border-charcoal-100 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-charcoal-100 px-4 py-2.5">
              <span className="tabular text-sm font-bold text-charcoal-700">
                伝票 #{order.order_number}
              </span>
              <span className="text-xs text-charcoal-400">{formatTime(order.placed_at)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  order.channel === 'mobile'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-charcoal-100 text-charcoal-500'
                }`}
              >
                {order.channel === 'mobile' ? 'モバイル' : 'レジ入力'}
              </span>
              {order.service_type === 'takeout' && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                  持ち帰り
                </span>
              )}
            </div>

            <ul className="divide-y divide-charcoal-50">
              {orderItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 px-4 py-3 ${
                    item.status === 'cancelled' ? 'opacity-40' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {item.name_snapshot}
                      {item.tax_rate < store.standard_tax_rate && (
                        <span className="ml-1 text-xs font-normal text-sky-700">※</span>
                      )}
                      {item.status === 'cancelled' && (
                        <span className="ml-2 text-xs font-normal">（取消）</span>
                      )}
                    </p>
                    {item.options_snapshot.length > 0 && (
                      <p className="mt-0.5 text-xs text-charcoal-500">
                        {item.options_snapshot.map((o) => o.name).join(' / ')}
                      </p>
                    )}
                    {item.note && (
                      <p className="mt-0.5 text-xs text-ember-600">備考: {item.note}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <StatusChip status={item.status} />
                      {item.payment_id !== null && (
                        <span className="rounded bg-charcoal-100 px-1.5 py-0.5 text-[11px] font-bold text-charcoal-500">
                          会計済
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="tabular w-10 shrink-0 text-right text-sm text-charcoal-500">
                    ×{item.quantity}
                  </span>
                  <span className="tabular w-20 shrink-0 text-right font-semibold">
                    {formatYen(item.line_total)}
                  </span>

                  {!readOnly && item.status !== 'cancelled' && item.payment_id === null && (
                    <div className="no-select flex shrink-0 gap-1">
                      {item.status !== 'served' && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => act(() => updateItemStatus(item.id, 'served'))}
                          className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 active:bg-emerald-100"
                        >
                          提供済
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`「${item.name_snapshot}」を取り消しますか？`)) {
                            act(() => updateItemQuantity(item.id, 0));
                          }
                        }}
                        className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 active:bg-red-100"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 合計パネル */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-charcoal-100 bg-white p-5">
          {paidCount > 0 && (
            <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
              一部が会計済みです。下の金額は未会計ぶんのみを表しています。
            </p>
          )}

          <Row label="小計" value={formatYen(total.subtotal)} />
          {store.service_charge_rate > 0 && (
            <Row
              label={`サービス料 ${(store.service_charge_rate * 100).toFixed(0)}%`}
              value={formatYen(total.service_charge)}
            />
          )}

          {/* 税率別の内訳 */}
          {total.tax_breakdown.map((row) => (
            <div key={row.rate} className="flex justify-between py-0.5 text-xs text-charcoal-400">
              <span>
                {formatTaxRate(row.rate)}対象 {formatYen(row.taxable)}
                {row.rate < store.standard_tax_rate && ' ※'}
              </span>
              <span className="tabular">
                {store.tax_included ? '内税 ' : '税 '}
                {formatYen(row.tax)}
              </span>
            </div>
          ))}

          <div className="mt-3 flex items-baseline justify-between border-t border-charcoal-100 pt-3">
            <span className="font-bold">合計</span>
            <span className="tabular text-3xl font-bold">{formatYen(total.total)}</span>
          </div>

          {total.tax_breakdown.some((r) => r.rate < store.standard_tax_rate) && (
            <p className="mt-2 text-[11px] text-charcoal-400">※ は軽減税率対象</p>
          )}

          {!readOnly && (
            <Button size="lg" className="mt-5 w-full" onClick={onCheckout}>
              お会計へ
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span>{label}</span>
      <span className="tabular font-semibold">{value}</span>
    </div>
  );
}

function StatusChip({ status }: { status: OrderItem['status'] }) {
  if (status === 'cancelled') return null;

  const tone = {
    pending: 'bg-amber-100 text-amber-800',
    cooking: 'bg-sky-100 text-sky-800',
    ready: 'bg-emerald-100 text-emerald-800',
    served: 'bg-charcoal-100 text-charcoal-500',
    cancelled: '',
  }[status];

  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${tone}`}>
      {ORDER_ITEM_STATUS_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 卓移動 / 伝票結合
// ---------------------------------------------------------------------------

function Sheet({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-charcoal-900/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-charcoal-500">{description}</p>}
        {children}
      </div>
    </div>
  );
}

function MoveDialog({
  sessionId,
  tables,
  onClose,
}: {
  sessionId: string;
  tables: TableOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function move(tableId: string) {
    setError(null);
    startTransition(async () => {
      const result = await moveSession(sessionId, tableId);
      if (!result.ok) {
        setError(result.error ?? '移動できませんでした');
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet title="卓を移動する" description="移動先の卓を選んでください" onClose={onClose}>
      {tables.length === 0 ? (
        <p className="mt-5 rounded-xl bg-charcoal-50 px-4 py-6 text-center text-sm text-charcoal-400">
          空いている卓がありません
        </p>
      ) : (
        <div className="no-select mt-5 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              disabled={pending}
              onClick={() => move(table.id)}
              className="rounded-xl bg-charcoal-100 px-3 py-4 text-sm font-bold text-charcoal-800
                transition-colors active:bg-charcoal-200 disabled:opacity-50"
            >
              {table.name}
              {table.area && (
                <span className="mt-0.5 block text-[11px] font-normal text-charcoal-400">
                  {table.area}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>
        閉じる
      </Button>
    </Sheet>
  );
}

function MergeDialog({
  sessionId,
  sessions,
  onClose,
}: {
  sessionId: string;
  sessions: SessionOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function merge(targetId: string, tableName: string) {
    if (!confirm(`この伝票を ${tableName} に結合しますか？\nこの卓は結合済みとして閉じられます。`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await mergeSessions(sessionId, targetId);
      if (!result.ok) {
        setError(result.error ?? '結合できませんでした');
        return;
      }
      onClose();
      router.push(`/pos/session/${targetId}`);
    });
  }

  return (
    <Sheet
      title="伝票を結合する"
      description="この伝票の注文を、選んだ卓の伝票にまとめます"
      onClose={onClose}
    >
      {sessions.length === 0 ? (
        <p className="mt-5 rounded-xl bg-charcoal-50 px-4 py-6 text-center text-sm text-charcoal-400">
          結合できる伝票がありません
        </p>
      ) : (
        <ul className="no-select mt-5 max-h-72 space-y-2 overflow-y-auto">
          {sessions.map((session) => (
            <li key={session.sessionId}>
              <button
                type="button"
                disabled={pending}
                onClick={() => merge(session.sessionId, session.tableName)}
                className="flex w-full items-center justify-between rounded-xl bg-charcoal-100 px-4 py-3
                  text-left font-bold text-charcoal-800 transition-colors active:bg-charcoal-200
                  disabled:opacity-50"
              >
                <span>{session.tableName}</span>
                <span className="tabular text-sm font-semibold text-charcoal-500">
                  {formatYen(session.total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>
        閉じる
      </Button>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// 注文入力
// ---------------------------------------------------------------------------

function OrderEntry({
  sessionId,
  menu,
  serviceType,
  onPlaced,
}: {
  sessionId: string;
  menu: CategoryWithItems[];
  serviceType: ServiceType;
  onPlaced: () => void;
}) {
  const router = useRouter();
  const cart = useCart();
  const [activeCategory, setActiveCategory] = useState(menu[0]?.id ?? '');
  const [dialogItem, setDialogItem] = useState<MenuItemWithOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const items = menu.find((c) => c.id === activeCategory)?.items ?? [];

  function pick(item: MenuItemWithOptions) {
    if (item.is_sold_out) return;
    // オプションがなければ 1 タップでカートへ。営業中の入力速度を優先する
    if (item.option_groups.length === 0) cart.add(buildCartLine(item, [], 1));
    else setDialogItem(item);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await placePosOrder(
        sessionId,
        cart.lines.map((line) => ({
          menu_id: line.menu_id,
          quantity: line.quantity,
          choice_ids: line.option_ids,
          note: line.note,
        }))
      );

      if (!result.ok) {
        setError(result.error ?? '注文を通せませんでした。');
        return;
      }
      cart.clear();
      onPlaced();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="no-select mb-4 flex flex-wrap gap-2">
          {menu.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                category.id === activeCategory
                  ? 'bg-charcoal-900 text-white'
                  : 'bg-white text-charcoal-600 hover:bg-charcoal-100'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              disabled={item.is_sold_out}
              className="no-select flex h-24 flex-col justify-between rounded-2xl border border-charcoal-100
                bg-white p-3 text-left transition-colors hover:border-ember-300
                disabled:bg-charcoal-100 disabled:opacity-60"
            >
              <span className="line-clamp-2 text-sm font-bold leading-snug">
                {item.name}
                {serviceType === 'takeout' && item.reduced_rate_eligible && (
                  <span className="ml-1 text-[11px] font-normal text-sky-700">8%</span>
                )}
              </span>
              <span className="tabular text-sm font-semibold text-charcoal-500">
                {item.is_sold_out ? '売切' : formatYen(item.price)}
              </span>
            </button>
          ))}
          {items.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-charcoal-400">
              このカテゴリに商品がありません
            </p>
          )}
        </div>
      </div>

      {/* カート */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-charcoal-100 bg-white">
          <div className="flex items-center gap-2 border-b border-charcoal-100 px-4 py-3">
            <p className="font-bold">追加する注文 {cart.count > 0 && `(${cart.count})`}</p>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${
                serviceType === 'takeout'
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-charcoal-100 text-charcoal-500'
              }`}
            >
              {SERVICE_TYPE_LABEL[serviceType]}
            </span>
          </div>

          <ul className="max-h-[50vh] divide-y divide-charcoal-50 overflow-y-auto">
            {cart.lines.map((line) => (
              <li key={line.key} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{line.name}</p>
                    {line.option_labels.length > 0 && (
                      <p className="text-xs text-charcoal-500">
                        {line.option_labels.map((o) => o.name).join(' / ')}
                      </p>
                    )}
                    {line.note && <p className="text-xs text-ember-600">{line.note}</p>}
                  </div>
                  <span className="tabular shrink-0 text-sm font-semibold">
                    {formatYen(lineTotal(line))}
                  </span>
                </div>

                <div className="no-select mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(line.key, line.quantity - 1)}
                    className="h-8 w-8 rounded-lg bg-charcoal-100 font-bold active:bg-charcoal-200"
                  >
                    −
                  </button>
                  <span className="tabular w-6 text-center font-semibold">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(line.key, line.quantity + 1)}
                    className="h-8 w-8 rounded-lg bg-charcoal-100 font-bold active:bg-charcoal-200"
                  >
                    ＋
                  </button>
                  <button
                    type="button"
                    onClick={() => cart.remove(line.key)}
                    className="ml-auto text-xs font-semibold text-red-500"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}

            {cart.lines.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-charcoal-400">
                商品を選んでください
              </li>
            )}
          </ul>

          {error && (
            <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="border-t border-charcoal-100 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm font-semibold">小計</span>
              <span className="tabular text-xl font-bold">{formatYen(cart.total)}</span>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={cart.count === 0 || pending}
              onClick={submit}
            >
              {pending ? '送信中…' : '注文を通す'}
            </Button>
          </div>
        </div>
      </div>

      {dialogItem && (
        <OptionDialog item={dialogItem} onAdd={cart.add} onClose={() => setDialogItem(null)} />
      )}
    </div>
  );
}
