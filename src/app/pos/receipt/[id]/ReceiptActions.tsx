'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui';
import { voidPayment } from '@/lib/actions/order';

/**
 * レシート画面の操作。
 *
 * 印刷はブラウザの印刷ダイアログを使う。
 * レシートプリンタ（ESC/POS）への直接出力は将来の課題。
 */
export function ReceiptActions({
  paymentId,
  voided,
}: {
  paymentId: string;
  voided: boolean;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="flex-1 rounded-xl border border-charcoal-300 bg-white py-3 font-bold text-charcoal-700"
      >
        印刷
      </button>

      {!voided && (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="rounded-xl border border-red-300 bg-white px-4 py-3 font-bold text-red-600"
        >
          会計取消
        </button>
      )}

      {asking && (
        <VoidDialog
          paymentId={paymentId}
          onClose={() => setAsking(false)}
          onDone={() => {
            setAsking(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function VoidDialog({
  paymentId,
  onClose,
  onDone,
}: {
  paymentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await voidPayment(paymentId, reason.trim() || '理由未記入');
      if (!result.ok) {
        setError(result.error ?? '取り消せませんでした');
        return;
      }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-charcoal-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">この会計を取り消しますか？</h2>
        <p className="mt-2 text-sm text-charcoal-500">
          会計の記録は「取消」として残り、売上からは除外されます。
          明細の紐付けが外れ、卓は利用中に戻ります。
        </p>

        <label className="mt-5 block">
          <span className="mb-1 block text-sm font-semibold text-charcoal-700">
            取消理由
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：金額の入力間違い"
            maxLength={100}
            autoFocus
            className="w-full rounded-xl border border-charcoal-200 px-3 py-2.5 outline-none
              focus:border-ember-400 focus:ring-2 focus:ring-ember-100"
          />
        </label>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            やめる
          </Button>
          <Button variant="danger" className="flex-1" disabled={pending} onClick={submit}>
            {pending ? '処理中…' : '取り消す'}
          </Button>
        </div>
      </div>
    </div>
  );
}
