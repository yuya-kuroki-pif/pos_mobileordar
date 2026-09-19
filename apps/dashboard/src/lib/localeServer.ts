import 'server-only';

import { cookies } from 'next/headers';

import { isUiLocale, UI_LOCALE_COOKIE, type UiLocale } from './uiLocale';

/** いま選ばれている表示言語。既定は日本語 */
export async function currentUiLocale(): Promise<UiLocale> {
  const value = (await cookies()).get(UI_LOCALE_COOKIE)?.value;
  return isUiLocale(value) ? value : 'ja';
}
