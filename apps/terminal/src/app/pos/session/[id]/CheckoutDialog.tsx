'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui';
import { checkout } from '@/lib/actions/order';
import { PAYMENT_METHOD_LABEL, formatTaxRate, formatYen } from '@/lib/format';
import type { OrderItem, PaymentMethod, SessionTotal, Store } from '@/lib/types';

const METHODS: PaymentMethod[] = ['cash', 'card', 'qr', 'e_money'];

/** 預かり金の入力を速くするための定番金額 */
const QUICK_AMOUNTS = [1000, 5000, 10000];

type Mode = 'full' | 'items' | 'split';

interface Quote {
  total: SessionTotal;
  splitCount: number;
  share: number;
  firstShare: number;
}

export function CheckoutDialog({
  sessionId,
  store,
  unpaidItems,
  onClose,
  onPartialPaid,
}: {
  sessionId: string;
  store: Store;
  /** 未会計の明細。明細指定の分割会計で選ばせる */
  unpaidItems: OrderItem[];
  onClose: () => void;
  /** まだ未会計が残る会計が済んだとき（画面を開いたまま次の会計へ進む） */
  onPartialPaid: () => void;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('full');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [splitCount, setSplitCount] = useState(2);
  const [splitIndex, setSplitIndex] = useState(1);

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState(0);
  const [received, setReceived] = useState<number | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 金額はサーバーに計算させる（税率別の按分をここで再実装しないため）
  const fetchQuote = useCallback(async () => {
    const params = new URLSearchParams({ discount: String(discount) });
    if (mode === 'items') params.set('itemIds', selectedIds.join(','));
    if (mode === 'split') params.set('splitCount', String(splitCount));

    try {
      const res = await fetch(`/api/pos/session/${sessionId}/quote?${params}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('failed');
      setQuote((await res.json()) as Quote);
    } catch {
      setError('金額の計算に失敗しました。通信状況を確認してください。');
    }
  }, [sessionId, discount, mode, selectedIds, splitCount]);

  useEffect(() => {
    void fetchQuote();
  }, [fetchQuote]);

  // 明細指定モードで 1 つも選んでいなければ会計できない
  const nothingSelected = mode === 'items' && selectedIds.length === 0;

  const amount =
    quote === null
      ? 0
      : mode === 'split'
        ? splitIndex === 1
          ? quote.firstShare
          : quote.share
        : quote.total.total;

  const isCash = method === 'cash';
  const change = isCash && received !== null ? received - amount : 0;
  const canSubmit =
    !pending &&
    quote !== null &&
    !nothingSelected &&
    amount > 0 &&
    (!isCash || (received !== null && received >= amount));

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await checkout(
        sessionId,
        method,
        discount,
        isCash ? (received ?? 0) : amount,
        undefined,
        {
          itemIds: mode === 'items' ? selectedIds : null,
          splitCount: mode === 'split' ? splitCount : 1,
          splitIndex: mode === 'split' ? splitIndex : 1,
        }
      );

      if (!result.ok || !result.id) {
        setError(result.error ?? '会計に失敗しました。');
        return;
      }

      // 人数割りの途中、または明細指定で未会計が残る場合は続けて会計する
      const moreSplits = mode === 'split' && splitIndex < splitCount;
      const moreItems =
        mode === 'items' && unpaidItems.some((item) => !selectedIds.includes(item.id));

      if (moreSplits) {
        setSplitIndex((v) => v + 1);
        setReceived(null);
        setDiscount(0); // 割引は 1 回目で適用済み
        onPartialPaid();
        return;
      }
      if (moreItems) {
        setSelectedIds([]);
        setReceived(null);
        onPartialPaid();
        return;
      }

      router.push(`/pos/receipt/${result.id}`);
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-charcoal-900/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-charcoal-100 px-6 py-4">
          <h2 className="text-lg font-bold">お会計</h2>
        </div>

        <div className="px-6 py-5">
          {/* 会計方法 */}
          <div className="no-select mb-5 grid grid-cols-3 gap-2">
            {(
              [
                ['full', '一括'],
                ['items', '明細で分ける'],
                ['split', '人数で割る'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setSelectedIds([]);
                  setSplitIndex(1);
                  setReceived(null);
                }}
                className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${
                  mode === key
                    ? 'bg-charcoal-900 text-white'
                    : 'bg-charcoal-100 text-charcoal-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 明細選択 */}
          {mode === 'items' && (
            <div className="mb-5 rounded-2xl border border-charcoal-200">
              <p className="border-b border-charcoal-100 px-4 py-2 text-xs font-bold text-charcoal-500">
                会計する明細を選ぶ（{selectedIds.length} / {unpaidItems.length}）
              </p>
              <ul className="max-h-56 divide-y divide-charcoal-50 overflow-y-auto">
                {unpaidItems.map((item) => {
                  const checked = selectedIds.includes(item.id);
                  return (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedIds((current) =>
                              checked
                                ? current.filter((id) => id !== item.id)
                                : [...current, item.id]
                            )
                          }
                          className="h-5 w-5 rounded border-charcoal-300 text-ember-600 focus:ring-ember-400"
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          {item.name_snapshot}
                          <span className="ml-1 text-charcoal-400">×{item.quantity}</span>
                        </span>
                        <span className="tabular text-sm font-semibold">
                          {formatYen(item.line_total)}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {unpaidItems.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-charcoal-400">
                    未会計の明細がありません
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* 人数割り */}
          {mode === 'split' && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-bold text-charcoal-700">何人で割る？</p>
              <div className="no-select grid grid-cols-6 gap-2">
                {[2, 3, 4, 5, 6, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setSplitCount(n);
                      setSplitIndex(1);
                    }}
                    className={`rounded-xl py-2.5 font-bold transition-colors ${
                      splitCount === n
                        ? 'bg-ember-600 text-white'
                        : 'bg-charcoal-100 text-charcoal-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                {splitIndex} 人目 / {splitCount} 人。1 人ずつ支払方法を選んで会計します。
                {splitIndex === 1 && ' 割り切れない端数は 1 人目が負担します。'}
              </p>
            </div>
          )}

          {/* 金額 */}
          <div className="rounded-2xl bg-charcoal-50 p-4">
            {quote === null ? (
              <p className="py-4 text-center text-sm text-charcoal-400">計算中…</p>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span>小計</span>
                  <span className="tabular font-semibold">{formatYen(quote.total.subtotal)}</span>
                </div>
                {quote.total.service_charge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>サービス料</span>
                    <span className="tabular font-semibold">
                      {formatYen(quote.total.service_charge)}
                    </span>
                  </div>
                )}
                {quote.total.discount > 0 && (
                  <div className="flex justify-between text-sm text-ember-600">
                    <span>割引</span>
                    <span className="tabular font-semibold">
                      -{formatYen(quote.total.discount)}
                    </span>
                  </div>
                )}

                {/* 税率別の内訳。インボイスの記載要件にあたる部分 */}
                {quote.total.tax_breakdown.map((row) => (
                  <div
                    key={row.rate}
                    className="flex justify-between text-xs text-charcoal-400"
                  >
                    <span>
                      {formatTaxRate(row.rate)}対象 {formatYen(row.taxable)}
                      {row.rate < store.standard_tax_rate && ' ※軽減'}
                    </span>
                    <span className="tabular">
                      {store.tax_included ? '内消費税 ' : '消費税 '}
                      {formatYen(row.tax)}
                    </span>
                  </div>
                ))}

                <div className="mt-2 flex items-baseline justify-between border-t border-charcoal-200 pt-2">
                  <span className="font-bold">
                    {mode === 'split' ? `${splitIndex}人目のお支払い` : '合計'}
                  </span>
                  <span className="tabular text-3xl font-bold">{formatYen(amount)}</span>
                </div>
                {mode === 'split' && (
                  <p className="tabular mt-1 text-right text-xs text-charcoal-400">
                    全体 {formatYen(quote.total.total)}
                  </p>
                )}
              </>
            )}
          </div>

          {/* 割引（人数割りの 2 人目以降は伏せる。全体に対して 1 回だけ適用するため） */}
          {!(mode === 'split' && splitIndex > 1) && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-charcoal-700">割引</p>
              <div className="no-select flex flex-wrap gap-2">
                {[0, 100, 500, 1000].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDiscount(value)}
                    className={`tabular rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                      discount === value
                        ? 'bg-charcoal-900 text-white'
                        : 'bg-charcoal-100 text-charcoal-600'
                    }`}
                  >
                    {value === 0 ? 'なし' : `-${formatYen(value)}`}
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="金額入力"
                  className="tabular w-28 rounded-xl border border-charcoal-200 px-3 py-2 text-sm
                    outline-none focus:border-ember-400"
                />
              </div>
            </div>
          )}

          {/* 支払方法 */}
          <div className="mt-5">
            <p className="mb-2 text-sm font-bold text-charcoal-700">支払方法</p>
            <div className="no-select grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m);
                    setReceived(null);
                  }}
                  className={`rounded-xl border-2 py-3 text-sm font-bold transition-colors ${
                    method === m
                      ? 'border-ember-500 bg-ember-50 text-ember-700'
                      : 'border-charcoal-100 bg-white text-charcoal-600'
                  }`}
                >
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-charcoal-400">
              現金以外は実際の決済端末で処理し、ここでは記録のみ行います。
            </p>
          </div>

          {/* 預かり金（現金のみ） */}
          {isCash && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-charcoal-700">お預かり</p>
              <div className="no-select flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReceived(amount)}
                  className="rounded-xl bg-charcoal-900 px-4 py-2 text-sm font-bold text-white"
                >
                  ちょうど
                </button>
                {QUICK_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReceived((v) => (v ?? 0) + value)}
                    className="tabular rounded-xl bg-charcoal-100 px-4 py-2 text-sm font-bold text-charcoal-700"
                  >
                    +{formatYen(value)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setReceived(null)}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-charcoal-400"
                >
                  クリア
                </button>
              </div>

              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={received ?? ''}
                onChange={(e) =>
                  setReceived(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))
                }
                placeholder="預かり金額"
                className="tabular mt-3 w-full rounded-xl border border-charcoal-200 px-4 py-3
                  text-right text-2xl font-bold outline-none focus:border-ember-400"
              />

              <div className="mt-3 flex items-baseline justify-between rounded-xl bg-emerald-50 px-4 py-3">
                <span className="font-bold text-emerald-800">おつり</span>
                <span className="tabular text-2xl font-bold text-emerald-800">
                  {formatYen(Math.max(0, change))}
                </span>
              </div>

              {received !== null && received < amount && (
                <p className="mt-2 text-sm font-semibold text-red-600">
                  {formatYen(amount - received)} 不足しています
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-charcoal-100 bg-white px-6 py-4">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            戻る
          </Button>
          <Button size="lg" className="flex-[2]" disabled={!canSubmit} onClick={submit}>
            {pending
              ? '処理中…'
              : nothingSelected
                ? '明細を選んでください'
                : `${formatYen(amount)} を会計する`}
          </Button>
        </div>
      </div>
    </div>
  );
}
