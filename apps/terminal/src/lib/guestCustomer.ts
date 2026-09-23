import 'server-only';

import * as demo from './demo/repo';
import { isDemoMode, supabaseAdmin } from './supabase';

/**
 * Zalo で特定できたお客様を customers に結び付ける。
 *
 * 顧客は法人単位で持つ（同じ法人の別店舗に来ても同じ人として数える）。
 * 来店は customer_visits に積んで、顧客分析と配信のセグメントから見えるようにする。
 */

export interface ZaloConnectSettings {
  app_id: string | null;
  oa_id: string | null;
  login_mode: 'off' | 'optional' | 'required';
  follow_coupon_id: string | null;
  headline: string | null;
  /** フォロー特典の表示名。画面に出すために一緒に引く */
  reward_text: string | null;
}

const DEFAULT_SETTINGS: ZaloConnectSettings = {
  app_id: null,
  oa_id: null,
  login_mode: 'optional',
  follow_coupon_id: null,
  headline: null,
  reward_text: null,
};

export async function getZaloConnectSettings(companyId: string): Promise<ZaloConnectSettings> {
  if (isDemoMode()) return demo.getZaloConnectSettings();

  const { data, error } = await supabaseAdmin()
    .from('zalo_connect_settings')
    .select('app_id, oa_id, login_mode, follow_coupon_id, headline')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = data as Omit<ZaloConnectSettings, 'reward_text'> | null;
  if (!row) return DEFAULT_SETTINGS;

  // 特典クーポンが設定されていれば、お客様に見せる名前を引く
  let rewardText: string | null = null;
  if (row.follow_coupon_id) {
    const { data: coupon } = await supabaseAdmin()
      .from('coupons')
      .select('display_name, name')
      .eq('id', row.follow_coupon_id)
      .maybeSingle();

    const found = coupon as { display_name: string | null; name: string } | null;
    rewardText = found ? (found.display_name ?? found.name) : null;
  }

  return { ...row, reward_text: rewardText };
}

export interface LinkedCustomer {
  id: string;
  displayName: string | null;
  visitCount: number;
  rankName: string | null;
}

/**
 * Zalo のユーザーを顧客として登録（すでにいれば更新）する。
 * 同意は、お客様が同意のチェックを入れたときだけ true にし、日時も残す。
 */
export async function linkZaloCustomer(input: {
  /** 顧客は法人単位で持つ。業態から法人を引く */
  companyId: string;
  zaloUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  marketingConsent: boolean;
}): Promise<LinkedCustomer> {
  if (isDemoMode()) return demo.linkZaloCustomer(input);

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: company } = await supabase
    .from('companies')
    .select('corporation_id')
    .eq('id', input.companyId)
    .maybeSingle();

  const corporationId = (company as { corporation_id: string } | null)?.corporation_id;
  if (!corporationId) throw new Error('業態が見つかりません');

  const { data: existing } = await supabase
    .from('customers')
    .select('id, display_name, visit_count, rank_name, marketing_consent')
    .eq('corporation_id', corporationId)
    .eq('zalo_user_id', input.zaloUserId)
    .maybeSingle();

  const row = existing as {
    id: string;
    display_name: string | null;
    visit_count: number;
    rank_name: string | null;
    marketing_consent: boolean;
  } | null;

  if (row) {
    // 一度取った同意は、あとから外さない限り残す
    const patch: Record<string, unknown> = {
      display_name: input.displayName ?? row.display_name,
      avatar_url: input.avatarUrl,
      zalo_followed_at: now,
    };
    if (input.marketingConsent && !row.marketing_consent) {
      patch.marketing_consent = true;
      patch.marketing_consent_at = now;
    }

    const { error } = await supabase.from('customers').update(patch).eq('id', row.id);
    if (error) throw new Error(error.message);

    return {
      id: row.id,
      displayName: input.displayName ?? row.display_name,
      visitCount: row.visit_count,
      rankName: row.rank_name,
    };
  }

  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      corporation_id: corporationId,
      zalo_user_id: input.zaloUserId,
      display_name: input.displayName,
      avatar_url: input.avatarUrl,
      first_visit_at: now,
      zalo_followed_at: now,
      marketing_consent: input.marketingConsent,
      marketing_consent_at: input.marketingConsent ? now : null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  return {
    id: (created as { id: string }).id,
    displayName: input.displayName,
    visitCount: 0,
    rankName: null,
  };
}

/** 来店を記録する。同じ卓で二重に積まないようにする */
export async function recordCheckin(input: {
  customerId: string;
  shopId: string;
  sessionId: string;
}): Promise<void> {
  if (isDemoMode()) {
    demo.recordCheckin(input);
    return;
  }

  const supabase = supabaseAdmin();

  const { data: already } = await supabase
    .from('customer_visits')
    .select('id')
    .eq('customer_id', input.customerId)
    .eq('table_session_id', input.sessionId)
    .maybeSingle();

  if (already) return;

  const now = new Date().toISOString();

  const { error } = await supabase.from('customer_visits').insert({
    customer_id: input.customerId,
    shop_id: input.shopId,
    table_session_id: input.sessionId,
    visited_at: now,
    is_checkin: true,
  });
  if (error) throw new Error(error.message);

  // 来店回数と最終来店日を進める
  const { data: row } = await supabase
    .from('customers')
    .select('visit_count')
    .eq('id', input.customerId)
    .maybeSingle();

  await supabase
    .from('customers')
    .update({
      visit_count: ((row as { visit_count: number } | null)?.visit_count ?? 0) + 1,
      last_visit_at: now,
    })
    .eq('id', input.customerId);
}

/** 連携済みのお客様の、画面に出すぶんの情報 */
export async function getMemberSummary(customerId: string): Promise<LinkedCustomer | null> {
  if (isDemoMode()) return demo.getGuestCustomer(customerId);

  const { data } = await supabaseAdmin()
    .from('customers')
    .select('id, display_name, visit_count, rank_name')
    .eq('id', customerId)
    .maybeSingle();

  const row = data as {
    id: string;
    display_name: string | null;
    visit_count: number;
    rank_name: string | null;
  } | null;

  return row
    ? {
        id: row.id,
        displayName: row.display_name,
        visitCount: row.visit_count,
        rankName: row.rank_name,
      }
    : null;
}
