'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { isUiLocale, UI_LOCALE_COOKIE } from '../uiLocale';

/** 表示言語の切り替え（日本語 / ベトナム語） */
export async function setUiLocaleAction(locale: string): Promise<{ ok: boolean }> {
  if (!isUiLocale(locale)) return { ok: false };

  (await cookies()).set(UI_LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}
