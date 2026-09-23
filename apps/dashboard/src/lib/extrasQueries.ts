import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  AccountAuditLog,
  CustomReport,
  CustomerCoupon,
  DeliveryJob,
  GoogleBusinessProfile,
  GoogleReview,
  Questionnaire,
  QuestionnaireQuestion,
} from './types';

/** 残りの画面ぶんの読み取り（§5.31 / §5.32 / §6.9 / §7.2 / §8.8） */

async function read<T>(
  table: string,
  demoPick: () => T[],
  build: (q: ReturnType<typeof supabaseAdmin>) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
  if (isDemoMode()) return clone(demoPick());

  const { data, error } = await build(supabaseAdmin());
  if (error) throw new Error((error as { message: string }).message);
  return (data ?? []) as T[];
}

export const getQuestionnaires = (companyId: string) =>
  read<Questionnaire>(
    'questionnaires',
    () => db().questionnaires.filter((q) => q.company_id === companyId),
    (q) => q.from('questionnaires').select('*').eq('company_id', companyId).order('kind')
  );

export const getQuestionnaireQuestions = (questionnaireId: string) =>
  read<QuestionnaireQuestion>(
    'questionnaire_questions',
    () => db().questionnaireQuestions.filter((q) => q.questionnaire_id === questionnaireId),
    (q) =>
      q
        .from('questionnaire_questions')
        .select('*')
        .eq('questionnaire_id', questionnaireId)
        .order('display_order')
  );

/** 配信実績。店舗で絞る（分析画面は店舗単位で見る） */
export const getDeliveryJobs = (shopIds: string[]) =>
  read<DeliveryJob>(
    'message_delivery_jobs',
    () => db().deliveryJobs.filter((j) => j.shop_id && shopIds.includes(j.shop_id)),
    (q) => q.from('message_delivery_jobs').select('*').in('shop_id', shopIds)
  );

export const getCustomerCoupons = (couponIds: string[]) =>
  read<CustomerCoupon>(
    'customer_coupons',
    () => db().customerCoupons.filter((c) => couponIds.includes(c.coupon_id)),
    (q) => q.from('customer_coupons').select('*').in('coupon_id', couponIds)
  );

export const getGoogleProfiles = (shopIds: string[]) =>
  read<GoogleBusinessProfile>(
    'google_business_profiles',
    () => db().googleProfiles.filter((p) => shopIds.includes(p.shop_id)),
    (q) => q.from('google_business_profiles').select('*').in('shop_id', shopIds)
  );

export const getGoogleReviews = (shopIds: string[]) =>
  read<GoogleReview>(
    'google_reviews',
    () => db().googleReviews.filter((r) => shopIds.includes(r.shop_id)),
    (q) => q.from('google_reviews').select('*').in('shop_id', shopIds).order('posted_at', { ascending: false })
  );

export const getCustomReports = (corporationId: string) =>
  read<CustomReport>(
    'custom_reports',
    () => db().customReports.filter((r) => r.corporation_id === corporationId),
    (q) => q.from('custom_reports').select('*').eq('corporation_id', corporationId)
  );

export const getAccountAuditLogs = (corporationId: string) =>
  read<AccountAuditLog>(
    'account_audit_logs',
    () => db().accountAuditLogs.filter((l) => l.corporation_id === corporationId),
    (q) =>
      q
        .from('account_audit_logs')
        .select('*')
        .eq('corporation_id', corporationId)
        .order('occurred_at', { ascending: false })
        .limit(500)
  );
