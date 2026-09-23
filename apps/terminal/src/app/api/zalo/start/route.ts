import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { isDemoMode } from '@/lib/supabase';
import { authorizeUrl, createPkce, isZaloLoginConfigured } from '@/lib/zalo';

/**
 * Zalo ログインの入口。
 * PKCE の verifier と、戻り先の卓トークン・同意の有無を短命 Cookie に預けてから
 * Zalo の承認画面へ送る。
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const consent = request.nextUrl.searchParams.get('consent') === '1';
  const lang = request.nextUrl.searchParams.get('lang') ?? 'ja';

  if (!token) return NextResponse.json({ error: 'token がありません' }, { status: 400 });

  const back = `/order/${token}?lang=${lang}`;
  const jar = await cookies();
  const shortLived = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // 10 分
  };

  jar.set('zalo_token', token, shortLived);
  jar.set('zalo_consent', consent ? '1' : '0', shortLived);
  jar.set('zalo_lang', lang, shortLived);

  // Zalo のアプリが未設定でも導線を確かめられるようにする
  if (!isZaloLoginConfigured()) {
    if (isDemoMode()) {
      return NextResponse.redirect(new URL('/api/zalo/callback?demo=1', request.url));
    }
    return NextResponse.redirect(new URL(`${back}&zalo=unconfigured`, request.url));
  }

  const { verifier, challenge } = createPkce();
  jar.set('zalo_verifier', verifier, shortLived);

  const state = crypto.randomUUID();
  jar.set('zalo_state', state, shortLived);

  return NextResponse.redirect(
    authorizeUrl({
      redirectUri: new URL('/api/zalo/callback', request.url).toString(),
      state,
      challenge,
    })
  );
}
