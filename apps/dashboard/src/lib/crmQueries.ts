import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  Coupon,
  CouponPreset,
  EmployeeReview,
  MessagingAccount,
  MembershipRank,
  MenuReview,
  MessageDelivery,
  MiniGame,
  QuestionnaireAnswer,
  ShopQuestionnaireSetting,
  ZaloConnectSettings,
} from './types';

/** CRM の読み取り（仕様書 §5.29〜§5.32） */

async function readByCompany<T>(
  table: string,
  companyId: string,
  demoPick: () => T[],
  order = 'id'
): Promise<T[]> {
  if (isDemoMode()) return clone(demoPick());

  const { data, error } = await supabaseAdmin()
    .from(table)
    .select('*')
    .eq('company_id', companyId)
    .order(order);

  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export const getCoupons = (companyId: string) =>
  readByCompany<Coupon>('coupons', companyId, () =>
    db().coupons.filter((c) => c.company_id === companyId)
  );

export const getCouponPresets = (companyId: string) =>
  readByCompany<CouponPreset>('coupon_presets', companyId, () =>
    db().couponPresets.filter((c) => c.company_id === companyId)
  );

/** LINE / Zalo の配信アカウント（§5.31 と Zalo 対応） */
export const getMessagingAccounts = (companyId: string) =>
  readByCompany<MessagingAccount>('messaging_accounts', companyId, () =>
    db().messagingAccounts.filter((a) => a.company_id === companyId)
  );

export const getMessageDeliveries = (companyId: string) =>
  readByCompany<MessageDelivery>('message_deliveries', companyId, () =>
    db().messageDeliveries.filter((d) => d.company_id === companyId)
  );

export const getMiniGames = (companyId: string) =>
  readByCompany<MiniGame>('mini_games', companyId, () =>
    db().miniGames.filter((g) => g.company_id === companyId)
  );

export const getMembershipRanks = (companyId: string) =>
  readByCompany<MembershipRank>('membership_ranks', companyId, () =>
    db().membershipRanks.filter((r) => r.company_id === companyId),
    'display_order'
  );

/** アンケートの回答（§5.32） */
export async function getQuestionnaireAnswers(
  shopIds: string[],
  from?: string,
  to?: string
): Promise<QuestionnaireAnswer[]> {
  if (shopIds.length === 0) return [];

  if (isDemoMode()) {
    return clone(
      db().questionnaireAnswers.filter((a) => {
        if (!shopIds.includes(a.shop_id)) return false;
        const day = a.answered_at.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      })
    );
  }

  let query = supabaseAdmin()
    .from('questionnaire_answers')
    .select('*')
    .in('shop_id', shopIds)
    .order('answered_at', { ascending: false })
    .limit(1000);

  if (from) query = query.gte('answered_at', `${from}T00:00:00+09:00`);
  if (to) query = query.lte('answered_at', `${to}T23:59:59+09:00`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as QuestionnaireAnswer[];
}

/** メニュー評価（§5.32） */
export async function getMenuReviews(shopIds: string[]): Promise<MenuReview[]> {
  if (shopIds.length === 0) return [];

  if (isDemoMode()) {
    return clone(db().menuReviews.filter((r) => shopIds.includes(r.shop_id)));
  }

  const { data, error } = await supabaseAdmin()
    .from('menu_reviews')
    .select('*')
    .in('shop_id', shopIds)
    .order('reviewed_at', { ascending: false })
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []) as MenuReview[];
}

/** スタッフ評価（§5.32） */
export async function getEmployeeReviews(shopIds: string[]): Promise<EmployeeReview[]> {
  if (shopIds.length === 0) return [];

  if (isDemoMode()) {
    return clone(db().employeeReviews.filter((r) => shopIds.includes(r.shop_id)));
  }

  const { data, error } = await supabaseAdmin()
    .from('employee_reviews')
    .select('*')
    .in('shop_id', shopIds)
    .order('reviewed_at', { ascending: false })
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []) as EmployeeReview[];
}

/** モバイルオーダーアンケートの店舗設定（§5.31） */
export async function getShopQuestionnaireSettings(
  shopIds: string[]
): Promise<ShopQuestionnaireSetting[]> {
  if (shopIds.length === 0) return [];

  const fallback = (shopId: string): ShopQuestionnaireSetting => ({
    shop_id: shopId,
    menu_review_enabled: false,
    staff_review_enabled: false,
  });

  if (isDemoMode()) {
    const rows = db().shopQuestionnaireSettings;
    return shopIds.map((id) => clone(rows.find((r) => r.shop_id === id)) ?? fallback(id));
  }

  const { data, error } = await supabaseAdmin()
    .from('shop_questionnaire_settings')
    .select('*')
    .in('shop_id', shopIds);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ShopQuestionnaireSetting[];
  return shopIds.map((id) => rows.find((r) => r.shop_id === id) ?? fallback(id));
}

/** Zalo ログイン連携の設定（案A）。未設定なら既定値を返す */
export async function getZaloConnectSettings(companyId: string): Promise<ZaloConnectSettings> {
  const fallback: ZaloConnectSettings = {
    company_id: companyId,
    app_id: null,
    oa_id: null,
    login_mode: 'optional',
    follow_coupon_id: null,
    headline: null,
    updated_at: null,
  };

  if (isDemoMode()) return clone(db().zaloConnectSettings ?? fallback);

  const { data, error } = await supabaseAdmin()
    .from('zalo_connect_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ZaloConnectSettings | null) ?? fallback;
}
