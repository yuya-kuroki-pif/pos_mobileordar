import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import * as demo from './demo';
import { getCompanies, getCorporation, getRoles, getShops } from './queries';
import { isDemoMode, supabaseAdmin } from './supabase';
import type { Account, SessionContext } from './types';
import type { PermissionMap } from './permissions';

/**
 * ダッシュボードのログインセッション。
 *
 * 仕様書 §10.1 は Supabase Auth（招待メール）を前提にしているが、
 * 招待メールの導線が整うまでの暫定として accounts テーブルの
 * パスワードハッシュで照合し、署名付き Cookie を発行する。
 * auth.users へ移行するときはこのファイルと verify_account_password を置き換える。
 */

const COOKIE_NAME = 'dashboard_session';
const MAX_AGE_SECONDS = 60 * 60 * 12;
const COMPANY_COOKIE = 'dashboard_company';

interface SessionPayload {
  accountId: string;
  corporationId: string;
  issuedAt: number;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      'SESSION_SECRET が未設定です。.env.local に 32 バイト以上のランダム文字列を設定してください。'
    );
  }
  return value;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function encode(session: SessionPayload): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): SessionPayload | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionPayload;
    if (Date.now() / 1000 - session.issuedAt > MAX_AGE_SECONDS) return null;
    return session;
  } catch {
    return null;
  }
}

/** メールとパスワードで照合し、セッション Cookie を発行する */
export async function login(email: string, password: string): Promise<boolean> {
  let accountId: string | null;
  let corporationId: string;

  if (isDemoMode()) {
    accountId = demo.verifyLogin(email, password);
    corporationId = demo.getCorporation().id;
  } else {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc('verify_account_password', {
      p_email: email,
      p_password: password,
    });
    if (error) throw new Error(`ログインに失敗しました: ${error.message}`);

    accountId = (data as string | null) ?? null;
    if (!accountId) return false;

    const { data: account } = await db
      .from('accounts')
      .select('corporation_id')
      .eq('id', accountId)
      .single();
    corporationId = (account as { corporation_id: string }).corporation_id;
  }

  if (!accountId) return false;

  (await cookies()).set(
    COOKIE_NAME,
    encode({ accountId, corporationId, issuedAt: Math.floor(Date.now() / 1000) }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE_SECONDS,
    }
  );

  return true;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  jar.delete(COMPANY_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? decode(token) : null;
}

/** ヘッダーの業態セレクタで選んだ業態を覚えておく */
export async function setCurrentCompany(companyId: string): Promise<void> {
  (await cookies()).set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * 全画面の入口で呼ぶ。未ログインならログイン画面へ飛ばす。
 * レイアウトと権限判定に必要なものをまとめて返す。
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect('/login');

  const [corporation, companies, shops, roles] = await Promise.all([
    getCorporation(session.corporationId),
    getCompanies(session.corporationId),
    getShops(session.corporationId),
    getRoles(session.corporationId),
  ]);

  if (!corporation) {
    await logout();
    redirect('/login');
  }

  const account = await loadAccount(session.accountId);
  if (!account) {
    await logout();
    redirect('/login');
  }

  const { permissions, roleName } = await loadPermissions(session.accountId, roles);

  // Cookie の業態が消えている / 権限外になっている場合は先頭の業態に戻す
  const cookieCompany = (await cookies()).get(COMPANY_COOKIE)?.value;
  const currentCompanyId =
    companies.find((c) => c.id === cookieCompany)?.id ?? companies[0]?.id ?? '';

  return { account, corporation, companies, shops, permissions, roleName, currentCompanyId };
}

async function loadAccount(accountId: string): Promise<Account | null> {
  if (isDemoMode()) return demo.getAccountById(accountId);

  const { data } = await supabaseAdmin()
    .from('accounts')
    .select('id, corporation_id, email, name, status, joined_at, created_at')
    .eq('id', accountId)
    .maybeSingle();
  return (data as Account) ?? null;
}

async function loadPermissions(
  accountId: string,
  roles: Awaited<ReturnType<typeof getRoles>>
): Promise<{ permissions: PermissionMap; roleName: string | null }> {
  if (isDemoMode()) {
    const role = demo.getRoleForAccount(accountId);
    return { permissions: role?.permissions ?? {}, roleName: role?.name ?? null };
  }

  const { data } = await supabaseAdmin()
    .from('account_roles')
    .select('role_id')
    .eq('account_id', accountId)
    .eq('product', 'pos')
    .maybeSingle();

  const roleId = (data as { role_id: string } | null)?.role_id;
  const role = roles.find((r) => r.id === roleId);
  return { permissions: role?.permissions ?? {}, roleName: role?.name ?? null };
}
