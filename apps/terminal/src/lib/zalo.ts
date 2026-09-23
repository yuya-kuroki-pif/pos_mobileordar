import 'server-only';

import crypto from 'node:crypto';

/**
 * Zalo ログイン（案A）。
 *
 * dinii の LINE ミニアプリに当たる部分を、いまの Web モバイルオーダーのまま実現する。
 * お客様が Zalo で承認すると Zalo のユーザー ID が取れるので、
 * それを customers に結び付けて、来店履歴・会員ランク・ZNS 配信につなげる。
 *
 * 将来 Zalo Mini App（案B）へ移っても、ここで得る user id の意味は変わらないので、
 * 顧客まわりのデータはそのまま使える。
 *
 * 注意: Zalo の仕様（エンドポイント・パラメータ・審査条件）は変わることがある。
 * 実際に繋ぐ前に公式ドキュメントで確認すること。
 */

/** Zalo Login v4。PKCE 必須 */
const AUTHORIZE_URL = 'https://oauth.zaloapp.com/v4/permission';
const TOKEN_URL = 'https://oauth.zaloapp.com/v4/access_token';
const PROFILE_URL = 'https://graph.zalo.me/v2.0/me';

export interface ZaloProfile {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export function isZaloLoginConfigured(): boolean {
  return Boolean(process.env.ZALO_APP_ID && process.env.ZALO_APP_SECRET);
}

/** OA のフォロー導線。OA ID が分かればリンクだけで飛ばせる */
export function zaloOaUrl(oaId: string | null): string | null {
  return oaId ? `https://zalo.me/${oaId}` : null;
}

/** PKCE の verifier と challenge。verifier は短命 Cookie に預ける */
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function authorizeUrl(input: {
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const params = new URLSearchParams({
    app_id: process.env.ZALO_APP_ID ?? '',
    redirect_uri: input.redirectUri,
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** 認可コードをアクセストークンに換える */
export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      secret_key: process.env.ZALO_APP_SECRET ?? '',
    },
    body: new URLSearchParams({
      app_id: process.env.ZALO_APP_ID ?? '',
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
    }),
  });

  const data = (await response.json()) as { access_token?: string; error?: unknown };
  if (!response.ok || !data.access_token) {
    throw new Error(`Zalo のトークン取得に失敗しました: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.access_token;
}

/** ユーザー ID と表示名を取る。お客様が承認した範囲だけが返る */
export async function fetchProfile(accessToken: string): Promise<ZaloProfile> {
  const url = `${PROFILE_URL}?fields=${encodeURIComponent('id,name,picture')}`;
  const response = await fetch(url, { headers: { access_token: accessToken } });

  const data = (await response.json()) as {
    id?: string;
    name?: string;
    picture?: { data?: { url?: string } };
  };

  if (!response.ok || !data.id) {
    throw new Error(`Zalo のプロフィール取得に失敗しました: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return {
    id: data.id,
    name: data.name ?? null,
    avatarUrl: data.picture?.data?.url ?? null,
  };
}
