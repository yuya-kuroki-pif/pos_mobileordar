'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { startSession } from '@/lib/actions/order';

/**
 * QR を読み込んだ直後の画面。
 * 卓がまだ開いていない場合に人数を聞く。
 */
export function Welcome({
  token,
  storeName,
  tableName,
  seats,
  note,
}: {
  token: string;
  storeName: string;
  tableName: string;
  seats: number;
  note: string | null;
}) {
  const router = useRouter();
  const [count, setCount] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choices = Array.from({ length: Math.max(seats, 6) + 2 }, (_, i) => i + 1);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await startSession(token, count);
      if (result.ok) router.refresh();
      else setError(result.error ?? 'エラーが発生しました。店員にお声がけください。');
    });
  }

  return (
    <main className="flex min-h-screen flex-col bg-charcoal-900 px-5 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <p className="text-sm text-charcoal-400">{tableName}</p>
        <h1 className="mt-1 text-3xl font-bold">{storeName}</h1>
        <p className="mt-4 text-charcoal-300">
          ご来店ありがとうございます。<br />
          人数を選んで注文をはじめてください。
        </p>

        {note && (
          <p className="mt-4 rounded-xl bg-charcoal-800 px-4 py-3 text-sm text-charcoal-300">
            {note}
          </p>
        )}

        <div className="no-select mt-8 grid grid-cols-4 gap-2">
          {choices.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`rounded-2xl py-4 text-xl font-bold transition-colors ${
                n === count ? 'bg-ember-500 text-white' : 'bg-charcoal-800 text-charcoal-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="mt-8 w-full rounded-2xl bg-ember-500 py-4 text-lg font-bold text-white
            transition-colors active:bg-ember-700 disabled:opacity-60"
        >
          {pending ? '準備中…' : `${count}名で注文をはじめる`}
        </button>

        <p className="mt-6 text-center text-xs text-charcoal-500">
          人数の変更やご不明な点は店員にお申し付けください
        </p>
      </div>
    </main>
  );
}
