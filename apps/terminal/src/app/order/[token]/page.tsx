import { notFound } from 'next/navigation';

import { SetupNotice } from '@/components/SetupNotice';
import {
  getMenuTree,
  getOpenSessionForTable,
  getSessionItems,
  getSessionTotal,
  getStoreById,
  getTableByToken,
} from '@/lib/queries';
import { getMemberSummary, getZaloConnectSettings, recordCheckin } from '@/lib/guestCustomer';
import { GUEST_LOCALE_PARAM, isGuestLocale } from '@/lib/guestLocale';
import { getGuestSession, hasSkippedConnect } from '@/lib/guestSession';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase';
import { zaloOaUrl } from '@/lib/zalo';

import { MobileOrder } from './MobileOrder';
import { Welcome } from './Welcome';
import { ZaloConnect } from './ZaloConnect';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseConfigured() && !isDemoMode()) return { title: 'モバイルオーダー' };
  const { token } = await params;
  const table = await getTableByToken(token);
  const store = table ? await getStoreById(table.store_id) : null;
  return { title: store ? `${store.name} | モバイルオーダー` : 'モバイルオーダー' };
}

/**
 * 客が卓の QR を読み込んだときに開く画面。
 * 認証はなく、「推測できない qr_token を知っていること」を入店の根拠にしている。
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!isSupabaseConfigured() && !isDemoMode()) {
    return (
      <main className="px-4 py-10">
        <SetupNotice />
      </main>
    );
  }

  const { token } = await params;

  // 言語は URL のクエリで持つ。QR に付けておけば最初から切り替えられる
  const query = await searchParams;
  const rawLocale = query[GUEST_LOCALE_PARAM];
  const locale = isGuestLocale(rawLocale) ? rawLocale : 'ja';

  const table = await getTableByToken(token);
  if (!table) notFound();

  const store = await getStoreById(table.store_id);
  if (!store) notFound();

  const session = await getOpenSessionForTable(table.id);

  // Zalo 連携（案A）。まだ誰だか分からないお客様には、注文の前に一度だけお願いする
  const zalo = await getZaloConnectSettings(store.company_id);
  const guest = await getGuestSession();

  if (zalo.login_mode !== 'off' && !guest && !(await hasSkippedConnect(token))) {
    return (
      <ZaloConnect
        token={token}
        storeName={store.name}
        locale={locale}
        mode={zalo.login_mode}
        headline={zalo.headline}
        rewardText={zalo.reward_text}
        oaUrl={zaloOaUrl(zalo.oa_id)}
      />
    );
  }

  // すでに分かっているお客様なら、この卓の来店として数えておく
  if (guest && session) {
    await recordCheckin({ customerId: guest.customerId, shopId: store.id, sessionId: session.id });
  }

  const member = guest ? await getMemberSummary(guest.customerId) : null;

  // まだ卓が開いていなければ、人数を聞く画面を出す
  if (!session) {
    return (
      <Welcome
        token={token}
        storeName={store.name}
        tableName={table.name}
        seats={table.seats}
        note={store.opening_note}
        locale={locale}
      />
    );
  }

  const [menu, items, total] = await Promise.all([
    getMenuTree(store.id, true, locale),
    getSessionItems(session.id),
    getSessionTotal(session.id),
  ]);

  return (
    <MobileOrder
      token={token}
      storeName={store.name}
      tableName={table.name}
      mobileOrderOpen={store.mobile_order_open}
      taxIncluded={store.tax_included}
      menu={menu}
      initialItems={items}
      initialTotal={total}
      initialStatus={session.status}
      locale={locale}
      member={
        member
          ? {
              displayName: member.displayName,
              visitCount: member.visitCount,
              rankName: member.rankName,
            }
          : null
      }
    />
  );
}
