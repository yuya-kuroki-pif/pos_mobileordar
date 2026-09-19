'use client';

import { useMemo, useRef, useState, useTransition } from 'react';

import { OptionDialog } from '@/components/OptionDialog';
import { placeMobileOrder, requestBill } from '@/lib/actions/order';
import { ORDER_ITEM_STATUS_LABEL, formatTime, formatYen } from '@/lib/format';
import type {
  CategoryWithItems,
  MenuItemWithOptions,
  OrderItem,
  SessionStatus,
  SessionTotal,
} from '@/lib/types';
import { buildCartLine, lineTotal, useCart } from '@/lib/useCart';
import { useLiveData } from '@/lib/useLiveData';

interface LiveData {
  session: { status: SessionStatus } | null;
  items: OrderItem[];
  total: SessionTotal | null;
}

type View = 'menu' | 'history';

export function MobileOrder({
  token,
  storeName,
  tableName,
  mobileOrderOpen,
  taxIncluded,
  menu,
  initialItems,
  initialTotal,
  initialStatus,
}: {
  token: string;
  storeName: string;
  tableName: string;
  mobileOrderOpen: boolean;
  taxIncluded: boolean;
  menu: CategoryWithItems[];
  initialItems: OrderItem[];
  initialTotal: SessionTotal;
  initialStatus: SessionStatus;
}) {
  const cart = useCart();
  const [view, setView] = useState<View>('menu');
  const [dialogItem, setDialogItem] = useState<MenuItemWithOptions | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 客の画面は更新頻度が低くてよい（自分の注文の調理状況が分かれば十分）
  const { data, refresh } = useLiveData<LiveData>(
    `/api/order/${token}`,
    { session: { status: initialStatus }, items: initialItems, total: initialTotal },
    10_000
  );

  // 会計が済むとセッションが閉じ、API が session: null を返すようになる
  if (data.session === null) return <ThankYou storeName={storeName} />;

  const billRequested = data.session.status === 'bill_requested';
  const activeItems = data.items.filter((item) => item.status !== 'cancelled');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      <header className="sticky top-0 z-20 border-b border-charcoal-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold">{storeName}</p>
            <p className="text-xs text-charcoal-400">{tableName}</p>
          </div>
          <div className="no-select flex rounded-xl bg-charcoal-100 p-1">
            <HeaderTab active={view === 'menu'} onClick={() => setView('menu')}>
              メニュー
            </HeaderTab>
            <HeaderTab active={view === 'history'} onClick={() => setView('history')}>
              注文履歴{activeItems.length > 0 && ` (${activeItems.length})`}
            </HeaderTab>
          </div>
        </div>
      </header>

      {!mobileOrderOpen && (
        <p className="bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ただいまモバイルからのご注文を停止しています。店員にお声がけください。
        </p>
      )}

      {billRequested && (
        <p className="bg-ember-50 px-4 py-3 text-sm font-semibold text-ember-700">
          お会計を承りました。店員がお伺いします。
        </p>
      )}

      {view === 'menu' ? (
        <MenuView
          menu={menu}
          disabled={!mobileOrderOpen}
          onPick={(item) => {
            if (item.option_groups.length === 0) {
              cart.add(buildCartLine(item, [], 1));
              showToast(`${item.name} をカートに追加しました`);
            } else {
              setDialogItem(item);
            }
          }}
        />
      ) : (
        <HistoryView
          items={data.items}
          total={data.total}
          taxIncluded={taxIncluded}
          billRequested={billRequested}
          token={token}
          onRequested={() => {
            refresh();
            showToast('お会計を承りました');
          }}
        />
      )}

      {/* カートボタン（メニュー表示中のみ） */}
      {view === 'menu' && cart.count > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="no-select fixed inset-x-4 bottom-4 z-30 flex items-center justify-between
            rounded-2xl bg-ember-600 px-5 py-4 text-white shadow-lg active:bg-ember-700"
        >
          <span className="flex items-center gap-2 font-bold">
            <span className="tabular flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-sm text-ember-700">
              {cart.count}
            </span>
            カートを見る
          </span>
          <span className="tabular text-lg font-bold">{formatYen(cart.total)}</span>
        </button>
      )}

      {dialogItem && (
        <OptionDialog
          item={dialogItem}
          onAdd={(line) => {
            cart.add(line);
            showToast(`${line.name} をカートに追加しました`);
          }}
          onClose={() => setDialogItem(null)}
        />
      )}

      {cartOpen && (
        <CartSheet
          token={token}
          cart={cart}
          onClose={() => setCartOpen(false)}
          onPlaced={() => {
            setCartOpen(false);
            setView('history');
            refresh();
            showToast('ご注文を承りました');
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 top-20 z-40 mx-auto w-fit rounded-full bg-charcoal-900 px-5 py-2.5
            text-sm font-semibold text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function HeaderTab({
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
      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? 'bg-white text-charcoal-900 shadow-sm' : 'text-charcoal-500'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// メニュー
// ---------------------------------------------------------------------------

function MenuView({
  menu,
  disabled,
  onPick,
}: {
  menu: CategoryWithItems[];
  disabled: boolean;
  onPick: (item: MenuItemWithOptions) => void;
}) {
  const [active, setActive] = useState(menu[0]?.id ?? '');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function jumpTo(categoryId: string) {
    setActive(categoryId);
    sectionRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      {/* カテゴリの横スクロールナビ */}
      <nav className="no-select sticky top-[60px] z-10 flex gap-2 overflow-x-auto border-b border-charcoal-100 bg-white px-4 py-2">
        {menu.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => jumpTo(category.id)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              active === category.id
                ? 'bg-charcoal-900 text-white'
                : 'bg-charcoal-100 text-charcoal-600'
            }`}
          >
            {category.name}
          </button>
        ))}
      </nav>

      {menu.map((category) => (
        <section
          key={category.id}
          ref={(el) => {
            sectionRefs.current[category.id] = el;
          }}
          // ナビが重ならないようスクロール位置をずらす
          className="scroll-mt-28 px-4 pt-6"
        >
          <h2 className="text-lg font-bold">{category.name}</h2>
          {category.description && (
            <p className="mt-0.5 text-xs text-charcoal-400">{category.description}</p>
          )}

          <ul className="mt-3 divide-y divide-charcoal-100">
            {category.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={disabled || item.is_sold_out}
                  onClick={() => onPick(item)}
                  className="flex w-full items-start gap-3 py-4 text-left disabled:opacity-40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.name}</p>
                    {item.description && (
                      <p className="mt-0.5 text-xs leading-relaxed text-charcoal-500">
                        {item.description}
                      </p>
                    )}
                    <p className="tabular mt-1 font-bold text-charcoal-900">
                      {formatYen(item.price)}
                    </p>
                    {item.is_sold_out && (
                      <span className="mt-1 inline-block rounded bg-charcoal-200 px-1.5 py-0.5 text-[11px] font-bold text-charcoal-600">
                        本日売切
                      </span>
                    )}
                  </div>
                  {item.image_url && (
                    // 画像は任意。URL が入っている商品だけサムネイルを出す
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    />
                  )}
                </button>
              </li>
            ))}
            {category.items.length === 0 && (
              <li className="py-6 text-sm text-charcoal-400">準備中です</li>
            )}
          </ul>
        </section>
      ))}

      <div className="h-10" />
    </>
  );
}

// ---------------------------------------------------------------------------
// 注文履歴
// ---------------------------------------------------------------------------

function HistoryView({
  items,
  total,
  taxIncluded,
  billRequested,
  token,
  onRequested,
}: {
  items: OrderItem[];
  total: SessionTotal | null;
  taxIncluded: boolean;
  billRequested: boolean;
  token: string;
  onRequested: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = items.filter((item) => item.status !== 'cancelled');

  function askForBill() {
    setError(null);
    startTransition(async () => {
      const result = await requestBill(token);
      if (result.ok) onRequested();
      else setError(result.error ?? 'エラーが発生しました。');
    });
  }

  return (
    <div className="px-4 pt-6">
      {active.length === 0 ? (
        <p className="py-16 text-center text-charcoal-400">まだご注文はありません</p>
      ) : (
        <ul className="divide-y divide-charcoal-100">
          {active.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.name_snapshot}</p>
                {item.options_snapshot.length > 0 && (
                  <p className="text-xs text-charcoal-500">
                    {item.options_snapshot.map((o) => o.name).join(' / ')}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <StatusPill status={item.status} />
                  <span className="text-[11px] text-charcoal-400">
                    {formatTime(item.created_at)}
                  </span>
                </div>
              </div>
              <span className="tabular w-8 text-right text-sm text-charcoal-500">
                ×{item.quantity}
              </span>
              <span className="tabular w-20 text-right font-semibold">
                {formatYen(item.line_total)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {total && active.length > 0 && (
        <div className="mt-6 rounded-2xl bg-charcoal-50 p-5">
          <div className="flex justify-between text-sm">
            <span>小計</span>
            <span className="tabular font-semibold">{formatYen(total.subtotal)}</span>
          </div>
          {total.service_charge > 0 && (
            <div className="flex justify-between text-sm">
              <span>サービス料</span>
              <span className="tabular font-semibold">{formatYen(total.service_charge)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-charcoal-400">
            <span>{taxIncluded ? '（内 消費税）' : '消費税'}</span>
            <span className="tabular">{formatYen(total.tax)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-charcoal-200 pt-2">
            <span className="font-bold">合計</span>
            <span className="tabular text-2xl font-bold">{formatYen(total.total)}</span>
          </div>
          <p className="mt-2 text-[11px] text-charcoal-400">
            お会計はレジまたは店員がお席でご案内します。
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {active.length > 0 && (
        <button
          type="button"
          onClick={askForBill}
          disabled={pending || billRequested}
          className="mt-5 w-full rounded-2xl border-2 border-ember-500 py-4 font-bold text-ember-600
            transition-colors active:bg-ember-50 disabled:border-charcoal-200 disabled:text-charcoal-400"
        >
          {billRequested ? 'お会計を承っています' : 'お会計をお願いする'}
        </button>
      )}

      <div className="h-10" />
    </div>
  );
}

function StatusPill({ status }: { status: OrderItem['status'] }) {
  const tone = {
    pending: 'bg-amber-100 text-amber-800',
    cooking: 'bg-sky-100 text-sky-800',
    ready: 'bg-emerald-100 text-emerald-800',
    served: 'bg-charcoal-100 text-charcoal-500',
    cancelled: 'bg-charcoal-100 text-charcoal-400',
  }[status];

  // 客には「調理中」「お持ちしました」くらいの粒度で伝わればよい
  const label = status === 'ready' ? 'まもなく提供' : ORDER_ITEM_STATUS_LABEL[status];

  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>
  );
}

// ---------------------------------------------------------------------------
// カート
// ---------------------------------------------------------------------------

function CartSheet({
  token,
  cart,
  onClose,
  onPlaced,
}: {
  token: string;
  cart: ReturnType<typeof useCart>;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await placeMobileOrder(
        token,
        cart.lines.map((line) => ({
          menu_item_id: line.menu_item_id,
          quantity: line.quantity,
          option_ids: line.option_ids,
          note: line.note,
        }))
      );

      if (!result.ok) {
        setError(result.error ?? '注文できませんでした。');
        return;
      }
      cart.clear();
      onPlaced();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-charcoal-900/60" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-charcoal-100 px-5 py-4">
          <h2 className="text-lg font-bold">カート</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm font-semibold text-charcoal-500"
          >
            閉じる
          </button>
        </div>

        <ul className="flex-1 divide-y divide-charcoal-100 overflow-y-auto px-5">
          {cart.lines.map((line) => (
            <li key={line.key} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{line.name}</p>
                  {line.option_labels.length > 0 && (
                    <p className="text-xs text-charcoal-500">
                      {line.option_labels.map((o) => o.name).join(' / ')}
                    </p>
                  )}
                  {line.note && <p className="text-xs text-ember-600">{line.note}</p>}
                </div>
                <span className="tabular shrink-0 font-semibold">
                  {formatYen(lineTotal(line))}
                </span>
              </div>

              <div className="no-select mt-2 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => cart.setQuantity(line.key, line.quantity - 1)}
                  className="h-9 w-9 rounded-full bg-charcoal-100 text-lg font-bold active:bg-charcoal-200"
                  aria-label="数量を減らす"
                >
                  −
                </button>
                <span className="tabular w-6 text-center font-semibold">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => cart.setQuantity(line.key, line.quantity + 1)}
                  className="h-9 w-9 rounded-full bg-charcoal-100 text-lg font-bold active:bg-charcoal-200"
                  aria-label="数量を増やす"
                >
                  ＋
                </button>
              </div>
            </li>
          ))}

          {cart.lines.length === 0 && (
            <li className="py-16 text-center text-charcoal-400">カートは空です</li>
          )}
        </ul>

        {error && (
          <p role="alert" className="mx-5 mb-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="border-t border-charcoal-100 px-5 py-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-semibold">小計</span>
            <span className="tabular text-2xl font-bold">{formatYen(cart.total)}</span>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={cart.count === 0 || pending}
            className="w-full rounded-2xl bg-ember-600 py-4 text-lg font-bold text-white
              transition-colors active:bg-ember-800 disabled:bg-charcoal-200 disabled:text-charcoal-400"
          >
            {pending ? '送信中…' : '注文を確定する'}
          </button>
          <p className="mt-2 text-center text-[11px] text-charcoal-400">
            確定後のキャンセルは店員にお申し付けください
          </p>
        </div>
      </div>
    </div>
  );
}

function ThankYou({ storeName }: { storeName: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-charcoal-900 px-6 text-center text-white">
      <h1 className="text-2xl font-bold">ありがとうございました</h1>
      <p className="mt-3 text-charcoal-300">
        {storeName}
        <br />
        またのご来店をお待ちしております。
      </p>
    </main>
  );
}
