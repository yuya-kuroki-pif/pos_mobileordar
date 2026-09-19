'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui';
import { checkout } from '@/lib/actions/order';
import { PAYMENT_METHOD_LABEL, formatYen } from '@/lib/format';
import type { PaymentMethod, SessionTotal } from '@/lib/types';

const METHODS: PaymentMethod[] = ['cash', 'card', 'qr', 'e_money'];

/** 預かり金の入力を速くするための定番金額 */
const QUICK_AMOUNTS = [1000, 5000, 10000];

export function CheckoutDialog({
  sessionId,
  baseTotal,
  taxRate,
  taxIncluded,
  onClose,
}: {
  sessionId: string;
  baseTotal: SessionTotal;
  taxRate: number;
  taxIncluded: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState(0);
  const [received, setReceived] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 割引後の金額。最終的な金額は会計時にサーバー側で計算し直すので、ここは表示用。
  const calc = useMemo(() => {
    const base = Math.max(baseTotal.subtotal + baseTotal.service_charge - discount, 0);
    const tax = taxIncluded
      ? Math.round((base * taxRate) / (1 + taxRate))
      : Math.round(base * taxRate);
    return { base, tax, total: taxIncluded ? base : base + tax };
  }, [baseTotal, discount, taxRate, taxIncluded]);

  const isCash = method === 'cash';
  const change = isCash && received !== null ? received - calc.total : 0;
  const canSubmit = !pending && (!isCash || (received !== null && received >= calc.total));

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await checkout(
        sessionId,
        method,
        discount,
        isCash ? (received ?? 0) : calc.total
      );

      if (!result.ok || !result.id) {
        setError(result.error ?? '会計に失敗しました。');
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
          {/* 金額 */}
          <div className="rounded-2xl bg-charcoal-50 p-4">
            <div className="flex justify-between text-sm">
              <span>小計</span>
              <span className="tabular font-semibold">{formatYen(baseTotal.subtotal)}</span>
            </div>
            {baseTotal.service_charge > 0 && (
              <div className="flex justify-between text-sm">
                <span>サービス料</span>
                <span className="tabular font-semibold">
                  {formatYen(baseTotal.service_charge)}
                </span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-sm text-ember-600">
                <span>割引</span>
                <span className="tabular font-semibold">-{formatYen(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-charcoal-400">
              <span>{taxIncluded ? '（内 消費税）' : '消費税'}</span>
              <span className="tabular">{formatYen(calc.tax)}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-charcoal-200 pt-2">
              <span className="font-bold">合計</span>
              <span className="tabular text-3xl font-bold">{formatYen(calc.total)}</span>
            </div>
          </div>

          {/* 割引 */}
          <div className="mt-5">
            <p className="mb-2 text-sm font-bold text-charcoal-700">割引</p>
            <div className="no-select flex flex-wrap gap-2">
              {[0, 100, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setDiscount(amount)}
                  className={`tabular rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                    discount === amount
                      ? 'bg-charcoal-900 text-white'
                      : 'bg-charcoal-100 text-charcoal-600'
                  }`}
                >
                  {amount === 0 ? 'なし' : `-${formatYen(amount)}`}
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
                  onClick={() => setReceived(calc.total)}
                  className="rounded-xl bg-charcoal-900 px-4 py-2 text-sm font-bold text-white"
                >
                  ちょうど
                </button>
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setReceived((v) => (v ?? 0) + amount)}
                    className="tabular rounded-xl bg-charcoal-100 px-4 py-2 text-sm font-bold text-charcoal-700"
                  >
                    +{formatYen(amount)}
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

              {received !== null && received < calc.total && (
                <p className="mt-2 text-sm font-semibold text-red-600">
                  {formatYen(calc.total - received)} 不足しています
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
            {pending ? '処理中…' : `${formatYen(calc.total)} を会計する`}
          </Button>
        </div>
      </div>
    </div>
  );
}
