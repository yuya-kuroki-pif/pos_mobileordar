'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { addCashMovement, closeCashDrawer } from '@/lib/actions/order';
import { CASH_MOVEMENT_LABEL, formatBusinessDate, formatTime, formatYen } from '@/lib/format';
import type { CashDrawerClosing, CashMovement, CashMovementKind } from '@/lib/types';

/** 実査でよく使う金種。枚数を入れると自動で合計する */
const DENOMINATIONS = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];

export function CloseDrawer({
  businessDay,
  today,
  cashSales,
  movements,
  closing,
  defaultFloat,
}: {
  businessDay: string;
  today: string;
  cashSales: number;
  movements: CashMovement[];
  closing: CashDrawerClosing | null;
  defaultFloat: number;
}) {
  const router = useRouter();

  const [openingFloat, setOpeningFloat] = useState(closing?.opening_float ?? defaultFloat);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [note, setNote] = useState(closing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cashIn = movements
    .filter((m) => m.kind === 'deposit')
    .reduce((sum, m) => sum + m.amount, 0);
  const cashOut = movements
    .filter((m) => m.kind === 'withdrawal')
    .reduce((sum, m) => sum + m.amount, 0);

  const expected = openingFloat + cashSales + cashIn - cashOut;

  // 金種ごとの枚数から実査額を出す。1 枚も入れていなければ締めボタンは押させない
  const counted = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] ?? 0), 0),
    [counts]
  );
  const hasCount = Object.values(counts).some((n) => n > 0);
  const difference = counted - expected;

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await closeCashDrawer(businessDay, openingFloat, counted, note);
      if (!result.ok) {
        setError(result.error ?? '締められませんでした');
        return;
      }
      setMessage('レジ締めを記録しました');
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="レジ締め"
        description={`${formatBusinessDate(businessDay)} の現金を確認します`}
        actions={
          <Link
            href="/pos"
            className="rounded-xl border border-charcoal-200 bg-white px-4 py-2 text-sm font-semibold text-charcoal-600"
          >
            フロアへ戻る
          </Link>
        }
      />

      {businessDay !== today && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          本日（{formatBusinessDate(today)}）以外の営業日を表示しています。
        </p>
      )}

      {closing && (
        <p className="mb-5 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
          この営業日は {formatTime(closing.closed_at)} に締め済みです。
          もう一度締めると上書きされます（過不足 {formatYen(closing.difference)}）。
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 理論在高 */}
        <Card className="p-6">
          <h2 className="mb-4 font-bold">理論在高</h2>

          <Field label="釣銭準備金" hint="開店時にレジへ入れた金額">
            <Input
              type="number"
              min={0}
              step={1000}
              value={openingFloat}
              onChange={(e) => setOpeningFloat(Math.max(0, Number(e.target.value) || 0))}
              className="tabular text-right"
            />
          </Field>

          <dl className="mt-5 space-y-2 text-sm">
            <Line label="現金売上" value={cashSales} />
            <Line label="入金" value={cashIn} />
            <Line label="出金" value={-cashOut} />
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-charcoal-100 pt-3">
            <span className="font-bold">理論在高</span>
            <span className="tabular text-2xl font-bold">{formatYen(expected)}</span>
          </div>

          <p className="mt-2 text-xs text-charcoal-400">
            釣銭準備金 + 現金売上 + 入金 − 出金。
            カード・QR 決済はレジの現金が増えないため含みません。
          </p>
        </Card>

        {/* 実査 */}
        <Card className="p-6">
          <h2 className="mb-1 font-bold">実査（金種を数える）</h2>
          <p className="mb-4 text-xs text-charcoal-400">
            レジの中の枚数を入力してください
          </p>

          <div className="grid grid-cols-3 gap-2">
            {DENOMINATIONS.map((value) => (
              <label key={value} className="block">
                <span className="tabular mb-1 block text-xs font-semibold text-charcoal-500">
                  {formatYen(value)}
                </span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={counts[value] ?? ''}
                  onChange={(e) =>
                    setCounts((current) => ({
                      ...current,
                      [value]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  placeholder="0"
                  className="tabular w-full rounded-xl border border-charcoal-200 px-2 py-2
                    text-right outline-none focus:border-ember-400"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t border-charcoal-100 pt-3">
            <span className="font-bold">実査額</span>
            <span className="tabular text-2xl font-bold">{formatYen(counted)}</span>
          </div>

          <div
            className={`mt-3 flex items-baseline justify-between rounded-xl px-4 py-3 ${
              !hasCount
                ? 'bg-charcoal-50 text-charcoal-400'
                : difference === 0
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-red-50 text-red-700'
            }`}
          >
            <span className="font-bold">過不足</span>
            <span className="tabular text-2xl font-bold">
              {!hasCount ? '—' : `${difference > 0 ? '+' : ''}${formatYen(difference)}`}
            </span>
          </div>

          <Field label="備考">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="過不足の理由など"
              className="mt-4"
            />
          </Field>

          {message && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button
            size="lg"
            className="mt-5 w-full"
            disabled={pending || !hasCount}
            onClick={submit}
          >
            {pending ? '記録中…' : 'レジを締める'}
          </Button>
        </Card>
      </div>

      <MovementsPanel businessDay={businessDay} movements={movements} />
    </main>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-charcoal-600">{label}</dt>
      <dd className="tabular font-semibold">
        {value < 0 ? `-${formatYen(-value)}` : formatYen(value)}
      </dd>
    </div>
  );
}

/** 営業中の入出金（両替・買い出しなど）の記録 */
function MovementsPanel({
  businessDay,
  movements,
}: {
  businessDay: string;
  movements: CashMovement[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<CashMovementKind>('withdrawal');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addCashMovement(businessDay, kind, Number(amount) || 0, reason);
      if (!result.ok) {
        setError(result.error ?? '記録できませんでした');
        return;
      }
      setAmount('');
      setReason('');
      router.refresh();
    });
  }

  return (
    <Card className="mt-5 p-6">
      <h2 className="mb-4 font-bold">入出金</h2>

      <div className="flex flex-wrap items-end gap-3">
        <div className="no-select inline-flex rounded-xl bg-charcoal-100 p-1">
          {(['deposit', 'withdrawal'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg px-5 py-2 text-sm font-bold transition-colors ${
                kind === k ? 'bg-white text-charcoal-900 shadow-sm' : 'text-charcoal-500'
              }`}
            >
              {CASH_MOVEMENT_LABEL[k]}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-charcoal-500">金額</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="tabular w-32 rounded-xl border border-charcoal-200 px-3 py-2.5
              text-right outline-none focus:border-ember-400"
          />
        </label>

        <label className="block min-w-48 flex-1">
          <span className="mb-1 block text-xs font-semibold text-charcoal-500">理由</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：氷の買い出し"
            className="w-full rounded-xl border border-charcoal-200 px-3 py-2.5
              outline-none focus:border-ember-400"
          />
        </label>

        <Button onClick={submit} disabled={pending || !amount}>
          {pending ? '記録中…' : '記録する'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {movements.length > 0 && (
        <ul className="mt-5 divide-y divide-charcoal-50 border-t border-charcoal-100">
          {movements.map((movement) => (
            <li key={movement.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span
                className={`rounded px-2 py-0.5 text-xs font-bold ${
                  movement.kind === 'deposit'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {CASH_MOVEMENT_LABEL[movement.kind]}
              </span>
              <span className="min-w-0 flex-1 truncate text-charcoal-600">
                {movement.reason ?? '—'}
              </span>
              <span className="text-xs text-charcoal-400">{formatTime(movement.created_at)}</span>
              <span className="tabular w-24 text-right font-semibold">
                {movement.kind === 'withdrawal' ? '-' : ''}
                {formatYen(movement.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
