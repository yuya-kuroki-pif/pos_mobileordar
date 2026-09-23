import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { linkZaloCustomer, recordCheckin } from '@/lib/guestCustomer';
import { setGuestSession } from '@/lib/guestSession';
import { getOpenSessionForTable, getStoreById, getTableByToken } from '@/lib/queries';
import { isDemoMode } from '@/lib/supabase';
import { exchangeCode, fetchProfile, type ZaloProfile } from '@/lib/zalo';

/**
 * Zalo の承認から戻ってくる先。
 * ユーザー ID を顧客に結び付け、その卓の来店として記録してから、注文画面へ返す。
 *
 * 失敗しても注文だけはできるように、エラーはクエリで知らせて画面は開かせる。
 */
export async function GET(request: NextRequest) {
  const jar = await cookies();
  const token = jar.get('zalo_token')?.value;
  const lang = jar.get('zalo_lang')?.value ?? 'ja';
  const consent = jar.get('zalo_consent')?.value === '1';

  const clear = () => {
    for (const name of ['zalo_token', 'zalo_lang', 'zalo_consent', 'zalo_verifier', 'zalo_state']) {
      jar.delete(name);
    }
  };

  if (!token) {
    clear();
    return NextResponse.redirect(new URL('/', request.url));
  }

  const back = (suffix = '') =>
    new URL(`/order/${token}?lang=${lang}${suffix}`, request.url);

  try {
    let profile: ZaloProfile;

    if (request.nextUrl.searchParams.get('demo') === '1' && isDemoMode()) {
      // デモ: Zalo の承認が通ったことにして、決まったユーザーを返す
      profile = { id: 'demo-zalo-user', name: 'Nguyễn Demo', avatarUrl: null };
    } else {
      const code = request.nextUrl.searchParams.get('code');
      const state = request.nextUrl.searchParams.get('state');
      const verifier = jar.get('zalo_verifier')?.value;
      const expectedState = jar.get('zalo_state')?.value;

      if (!code || !verifier) throw new Error('認可コードがありません');
      // state が合わないリクエストは受け付けない
      if (!state || !expectedState || state !== expectedState) {
        throw new Error('state が一致しません');
      }

      profile = await fetchProfile(await exchangeCode(code, verifier));
    }

    const table = await getTableByToken(token);
    const store = table ? await getStoreById(table.store_id) : null;
    if (!table || !store) throw new Error('卓が見つかりません');

    const customer = await linkZaloCustomer({
      companyId: store.company_id,
      zaloUserId: profile.id,
      displayName: profile.name,
      avatarUrl: profile.avatarUrl,
      marketingConsent: consent,
    });

    await setGuestSession(customer.id);

    // すでに卓が開いていれば、その来店として数える
    const session = await getOpenSessionForTable(table.id);
    if (session) {
      await recordCheckin({ customerId: customer.id, shopId: store.id, sessionId: session.id });
    }

    clear();
    return NextResponse.redirect(back('&zalo=ok'));
  } catch (error) {
    console.error('[zalo] 連携に失敗しました', error);
    clear();
    return NextResponse.redirect(back('&zalo=failed'));
  }
}
