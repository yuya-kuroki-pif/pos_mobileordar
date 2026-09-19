'use server';

import { redirect } from 'next/navigation';

import { loginWithPin, logout as clearSession } from '../auth';

export interface LoginState {
  error?: string;
}

/**
 * 店舗コードと PIN でログインする。
 * useActionState から呼ぶためシグネチャを (prevState, formData) にしている。
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const slug = String(formData.get('slug') ?? '').trim();
  const pin = String(formData.get('pin') ?? '').trim();
  const next = String(formData.get('next') ?? '/pos');

  if (!slug || !pin) {
    return { error: '店舗コードと PIN を入力してください。' };
  }

  let ok: boolean;
  try {
    ok = await loginWithPin(slug, pin);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'ログインに失敗しました。' };
  }

  if (!ok) {
    // 店舗コードと PIN のどちらが違うかは伝えない（総当たりの手がかりを与えない）
    return { error: '店舗コードまたは PIN が違います。' };
  }

  // リダイレクト先は自サイト内に限定する（オープンリダイレクト対策）
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/pos');
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/login');
}
