import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { supabaseAdmin } from './supabase';
import type { Store } from './types';

const COOKIE_NAME = 'pos_staff_session';
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 時間（1 営業日ぶん）

export interface StaffSession {
  storeId: string;
  storeSlug: string;
  /** 発行時刻（UNIX 秒）。有効期限の判定に使う */
  issuedAt: number;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      'SESSION_SECRET が未設定です。.env.local に 32 バイト以上のランダム文字列を設定してください。\n' +
        '生成例: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return value;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function encode(session: StaffSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): StaffSession | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  // タイミング攻撃を避けるため timingSafeEqual で比較する
  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as StaffSession;
    if (Date.now() / 1000 - session.issuedAt > MAX_AGE_SECONDS) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * PIN を照合してセッション Cookie を発行する。
 * 成功すれば true、PIN 不一致なら false。
 */
export async function loginWithPin(storeSlug: string, pin: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc('verify_staff_pin', {
    p_slug: storeSlug,
    p_pin: pin,
  });

  if (error) throw new Error(`PIN の照合に失敗しました: ${error.message}`);
  if (!data) return false;

  const session: StaffSession = {
    storeId: data as string,
    storeSlug,
    issuedAt: Math.floor(Date.now() / 1000),
  };

  (await cookies()).set(COOKIE_NAME, encode(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  return true;
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/** ログイン中のスタッフセッション。未ログインなら null */
export async function getStaffSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? decode(token) : null;
}

/**
 * スタッフ向け画面の入口で呼ぶ。未ログインならログイン画面へ飛ばす。
 * 戻り値は操作対象の店舗。
 */
export async function requireStore(): Promise<Store> {
  const session = await getStaffSession();
  if (!session) redirect('/login');

  const { data, error } = await supabaseAdmin()
    .from('stores')
    .select('*')
    .eq('id', session.storeId)
    .single<Store>();

  // 店舗が消えている（DB を作り直した等）場合もログインからやり直させる
  if (error || !data) {
    await logout();
    redirect('/login');
  }

  return data;
}
