'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { OptionDialog } from '@/components/OptionDialog';
import { Button } from '@/components/ui';
import { placePosOrder, updateItemQuantity, updateItemStatus } from '@/lib/actions/order';
import { ORDER_ITEM_STATUS_LABEL, formatTime, formatYen } from '@/lib/format';
import type {
  CategoryWithItems,
  MenuItemWithOptions,
  Order,
  OrderItem,
  SessionTotal,
  TableSession,
} from '@/lib/types';
import { buildCartLine, lineTotal, useCart } from '@/lib/useCart';
import { useLiveData } from '@/lib/useLiveData';

import { CheckoutDialog } from './CheckoutDialog';

interface LiveData {
  session: TableSession;
  items: OrderItem[];
  total: SessionTotal;
}

export function SessionView({
  sessionId,
  initialSession,
  initialItems,
  orders,
  initialTotal,
  menu,
  serviceChargeRate,
  taxRate,
  taxIncluded,
  readOnly,
}: {
  sessionId: string;
  initialSession: TableSession;
  initialItems: OrderItem[];
  orders: Order[];
  initialTotal: SessionTotal;
  menu: CategoryWithItems[];
  serviceChargeRate: number;
  taxRate: number;
  taxIncluded: boolean;
  readOnly: boolean;
}) {
  const [tab, setTab] = useState<'bill' | 'order'>(readOnly ? 'bill' : 'bill');
  const [checkingOut, setCheckingOut] = useState(false);

  const { data, refresh } = useLiveData<LiveData>(
    `/api/pos/session/${sessionId}`,
    { session: initialSession, items: initialItems, total: initialTotal },
    // 伝票はフロアマップほど頻繁に変わらないので少し長めの間隔にする
    6000
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      {!readOnly && (
        <div className="no-select mb-5 inline-flex rounded-xl bg-charcoal-100 p-1">
          <TabButton active={tab === 'bill'} onClick={() => setTab('bill')}>
            伝票
          </TabButton>
          <TabButton active={tab === 'order'} onClick={() => setTab('order')}>
            注文入力
          </TabButton>
        </div>
      )}

      {tab === 'bill' ? (
        <BillView
          items={data.items}
          orders={orders}
          total={data.total}
          serviceChargeRate={serviceChargeRate}
          taxIncluded={taxIncluded}
          readOnly={readOnly}
          onChanged={refresh}
          onCheckout={() => setCheckingOut(true)}
        />
      ) : (
        <OrderEntry sessionId={sessionId} menu={menu} onPlaced={() => { refresh(); setTab('bill'); }} />
      )}

      {checkingOut && (
        <CheckoutDialog
          sessionId={sessionId}
          baseTotal={data.total}
          taxRate={taxRate}
          taxIncluded={taxIncluded}
          onClose={() => setCheckingOut(false)}
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

// ---------------------------------------------------------------------------
// 伝票
// ---------------------------------------------------------------------------

function BillView({
  items,
  orders,
  total,
  serviceChargeRate,
  taxIncluded,
  readOnly,
  onChanged,
  onCheckout,
}: {
  items: OrderItem[];
  orders: Order[];
  total: SessionTotal;
  serviceChargeRate: number;
  taxIncluded: boolean;
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
            <div className="flex items-center gap-2 border-b border-charcoal-100 px-4 py-2.5">
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
                    <StatusChip status={item.status} />
                  </div>

                  <span className="tabular w-10 shrink-0 text-right text-sm text-charcoal-500">
                    ×{item.quantity}
                  </span>
                  <span className="tabular w-20 shrink-0 text-right font-semibold">
                    {formatYen(item.line_total)}
                  </span>

                  {!readOnly && item.status !== 'cancelled' && (
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
          <Row label="小計" value={formatYen(total.subtotal)} />
          {serviceChargeRate > 0 && (
            <Row
              label={`サービス料 ${(serviceChargeRate * 100).toFixed(0)}%`}
              value={formatYen(total.service_charge)}
            />
          )}
          <Row
            label={taxIncluded ? '（内 消費税）' : '消費税'}
            value={formatYen(total.tax)}
            muted
          />

          <div className="mt-3 flex items-baseline justify-between border-t border-charcoal-100 pt-3">
            <span className="font-bold">合計</span>
            <span className="tabular text-3xl font-bold">{formatYen(total.total)}</span>
          </div>

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

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${muted ? 'text-charcoal-400' : ''}`}>
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
    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${tone}`}>
      {ORDER_ITEM_STATUS_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 注文入力
// ---------------------------------------------------------------------------

function OrderEntry({
  sessionId,
  menu,
  onPlaced,
}: {
  sessionId: string;
  menu: CategoryWithItems[];
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
          menu_item_id: line.menu_item_id,
          quantity: line.quantity,
          option_ids: line.option_ids,
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
              <span className="line-clamp-2 text-sm font-bold leading-snug">{item.name}</span>
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
          <p className="border-b border-charcoal-100 px-4 py-3 font-bold">
            追加する注文 {cart.count > 0 && `(${cart.count})`}
          </p>

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
        <OptionDialog
          item={dialogItem}
          onAdd={cart.add}
          onClose={() => setDialogItem(null)}
        />
      )}
    </div>
  );
}
