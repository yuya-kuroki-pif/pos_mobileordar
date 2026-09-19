'use client';

import { createContext, useContext, useMemo } from 'react';

import { makeTranslator, type UiLocale } from '@/lib/uiLocale';

const LocaleContext = createContext<UiLocale>('ja');

/**
 * 表示言語をクライアント側へ配る。
 * PageHeader のように、あちこちから使われる共通部品で訳を引くために置く。
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: UiLocale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useUiLocale(): UiLocale {
  return useContext(LocaleContext);
}

/** `const t = useT()` のように使う。訳が無ければ日本語のまま */
export function useT() {
  const locale = useUiLocale();
  return useMemo(() => makeTranslator(locale), [locale]);
}
