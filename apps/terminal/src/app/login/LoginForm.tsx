'use client';

import { useActionState, useState } from 'react';

import { loginAction, type LoginState } from '@/lib/actions/auth';

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

/**
 * 店舗コード + PIN のログインフォーム。
 * POS 端末はタブレットで使うため、PIN はソフトキーボードではなく
 * 画面上のテンキーで入力できるようにしている。
 */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [pin, setPin] = useState('');

  function press(key: string) {
    if (key === 'clear') return setPin('');
    if (key === 'back') return setPin((v) => v.slice(0, -1));
    if (pin.length >= 8) return;
    setPin((v) => v + key);
  }

  return (
    <form action={formAction} className="rounded-2xl bg-white p-6 shadow-xl">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="pin" value={pin} />

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-charcoal-700">店舗コード</span>
        <input
          name="slug"
          defaultValue="demo"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-charcoal-200 px-3 py-2.5 outline-none
            focus:border-ember-400 focus:ring-2 focus:ring-ember-100"
        />
      </label>

      <div className="mt-5">
        <span className="mb-2 block text-sm font-semibold text-charcoal-700">PIN</span>
        <div className="flex h-12 items-center justify-center gap-3 rounded-xl border border-charcoal-200 bg-charcoal-50">
          {pin.length === 0 ? (
            <span className="text-sm text-charcoal-300">テンキーで入力</span>
          ) : (
            Array.from(pin).map((_, index) => (
              <span key={index} className="h-3 w-3 rounded-full bg-charcoal-700" />
            ))
          )}
        </div>
      </div>

      <div className="no-select mt-3 grid grid-cols-3 gap-2">
        {KEYPAD.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="rounded-xl bg-charcoal-100 py-4 text-xl font-semibold text-charcoal-800
              transition-colors active:bg-charcoal-200"
          >
            {key === 'clear' ? 'C' : key === 'back' ? '←' : key}
          </button>
        ))}
      </div>

      {state.error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || pin.length < 4}
        className="mt-5 w-full rounded-xl bg-ember-600 py-3.5 font-bold text-white
          transition-colors hover:bg-ember-700 disabled:bg-charcoal-200 disabled:text-charcoal-400"
      >
        {pending ? 'ログイン中…' : 'ログイン'}
      </button>

      <p className="mt-4 text-center text-xs text-charcoal-400">
        デモデータの初期値は 店舗コード <code className="font-semibold">demo</code> / PIN{' '}
        <code className="font-semibold">1234</code>
      </p>
    </form>
  );
}
