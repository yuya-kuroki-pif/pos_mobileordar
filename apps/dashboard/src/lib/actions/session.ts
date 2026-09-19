'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { login, logout as clearSession, setCurrentCompany } from '../auth';

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'メールアドレスとパスワードを入力してください。' };
  }

  let ok: boolean;
  try {
    ok = await login(email, password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'ログインに失敗しました。' };
  }

  // どちらが違うかは伝えない（総当たりの手がかりを与えない）
  if (!ok) return { error: 'メールアドレスまたはパスワードが違います。' };

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/login');
}

/** ヘッダーの業態セレクタ */
export async function switchCompanyAction(companyId: string): Promise<void> {
  await setCurrentCompany(companyId);
  revalidatePath('/', 'layout');
}
