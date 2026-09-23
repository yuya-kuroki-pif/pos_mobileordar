'use client';

import { useState, useTransition } from 'react';

import { LanguagePicker } from '@/components/LanguagePicker';
import { makeGuestTranslator, type GuestLocale } from '@/lib/guestLocale';

import { skipZaloConnect } from './actions';

/**
 * QR を読んだお客様に、注文の前に Zalo 連携をお願いする画面（仕様: 案A）。
 *
 * 連携すると Zalo のユーザー ID が取れるので、来店履歴・会員ランク・
 * ZNS でのお知らせがつながる。dinii の LINE ミニアプリに当たる部分。
 *
 * mode が 'required' でなければスキップできる。
 * お腹を空かせたお客様の注文を止めないほうが、結局は売上もフォロワーも増えるため、
 * 既定は 'optional'（ダッシュボードで変更できる）。
 */
export function ZaloConnect({
  token,
  storeName,
  locale,
  mode,
  headline,
  rewardText,
  oaUrl,
}: {
  token: string;
  storeName: string;
  locale: GuestLocale;
  mode: 'optional' | 'required';
  headline: string | null;
  /** フォロー特典。設定されていれば一番目立つところに出す */
  rewardText: string | null;
  oaUrl: string | null;
}) {
  const t = makeGuestTranslator(locale);
  const [consent, setConsent] = useState(true);
  const [pending, startTransition] = useTransition();

  const startUrl =
    `/api/zalo/start?token=${encodeURIComponent(token)}` +
    `&consent=${consent ? '1' : '0'}&lang=${locale}`;

  return (
    <main className="flex min-h-screen flex-col bg-charcoal-900 px-6 py-10 text-white">
      <div className="flex justify-end">
        <LanguagePicker current={locale} tone="dark" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-sm text-charcoal-300">{storeName}</p>

        <h1 className="mt-3 text-2xl font-bold leading-snug">
          {headline || t('お得な情報をお届けします')}
        </h1>

        {rewardText && (
          <div className="mt-6 w-full max-w-sm rounded-2xl bg-ember-500/15 px-5 py-4 text-ember-200">
            <p className="text-xs font-bold tracking-wide">{t('フォローすると特典がもらえます')}</p>
            <p className="mt-1 text-lg font-bold text-white">{rewardText}</p>
          </div>
        )}

        <a
          href={startUrl}
          className="mt-8 w-full max-w-sm rounded-2xl bg-[#0068FF] px-6 py-4 text-center text-base font-bold text-white"
        >
          {t('Zalo でつながる')}
        </a>

        <label className="mt-5 flex w-full max-w-sm cursor-pointer items-start gap-3 text-left text-sm text-charcoal-200">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-ember-500"
          />
          <span>
            {t('キャンペーンやクーポンの案内を受け取る')}
            <span className="mt-0.5 block text-xs text-charcoal-400">
              {t('いつでも受信を止められます')}
            </span>
          </span>
        </label>

        {oaUrl && (
          <a
            href={oaUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 text-xs text-charcoal-400 underline"
          >
            {t('Zalo 公式アカウントをフォロー')}
          </a>
        )}
      </div>

      {/* 注文を止めないための逃げ道。required のときだけ出さない */}
      {mode !== 'required' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => skipZaloConnect(token))}
          className="mx-auto mt-8 px-6 py-3 text-sm text-charcoal-400 underline disabled:opacity-50"
        >
          {pending ? '…' : t('このまま注文する')}
        </button>
      )}
    </main>
  );
}
