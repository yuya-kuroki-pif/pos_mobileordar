import 'server-only';

import type {
  Coupon,
  CouponPreset,
  Customer,
  CustomerGender,
  EmployeeReview,
  LineOfficialAccount,
  MembershipRank,
  MenuReview,
  MessageDelivery,
  MiniGame,
  QuestionnaireAnswer,
  ShopQuestionnaireSetting,
} from './types';

/** CRM（仕様書 §5.29〜§5.32）のデモデータ */

export interface CrmState {
  customers: Customer[];
  lineAccounts: LineOfficialAccount[];
  coupons: Coupon[];
  couponPresets: CouponPreset[];
  messageDeliveries: MessageDelivery[];
  miniGames: MiniGame[];
  membershipRanks: MembershipRank[];
  questionnaireAnswers: QuestionnaireAnswer[];
  menuReviews: MenuReview[];
  employeeReviews: EmployeeReview[];
  shopQuestionnaireSettings: ShopQuestionnaireSetting[];
}

function makeRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

const CHANNELS = [
  '通りがかり',
  '知人の紹介',
  'Google検索',
  'Googleマップ',
  '食べログ',
  'Instagram',
  'ホットペッパーグルメ',
];

const REVIEW_TAGS = ['美味しい', '見た目が良い', '量がちょうどいい', '価格が手頃', '香りが良い'];

const COMMENTS = [
  '料理が出てくるのが早くて助かりました。',
  '串の焼き加減がちょうどよかったです。',
  '店員さんの対応が丁寧でした。',
  '席の間隔がゆったりしていて過ごしやすかった。',
  '少し混んでいて注文に時間がかかりました。',
  'また来ます。',
];

export function buildCrm(
  corporationId: string,
  companyIds: string[],
  shopIds: string[],
  menuIds: string[],
  clerkIdsByShop: Record<string, string[]>
): CrmState {
  const random = makeRandom(526019);
  const genders: CustomerGender[] = ['male', 'female', 'other', 'unknown'];

  const customers: Customer[] = Array.from({ length: 120 }).map((_, i) => {
    const visits = 1 + Math.floor(random() * 14);
    return {
      id: `cust-${i}`,
      corporation_id: corporationId,
      line_user_id: `U${String(i).padStart(6, '0')}`,
      display_name: `お客様 ${i + 1}`,
      gender: genders[Math.floor(random() * genders.length)],
      birth_date: `19${70 + Math.floor(random() * 30)}-0${1 + Math.floor(random() * 9)}-15`,
      first_visit_at: '2026-06-01T18:00:00+09:00',
      last_visit_at: `2026-09-${String(1 + Math.floor(random() * 18)).padStart(2, '0')}T20:00:00+09:00`,
      visit_count: visits,
      rank_name: visits >= 13 ? 'プラチナ' : visits >= 7 ? 'ゴールド' : visits >= 3 ? 'シルバー' : 'レギュラー',
    };
  });

  const coupons: Coupon[] = companyIds.flatMap((companyId, index) => [
    {
      id: `${companyId}-coupon-1`,
      company_id: companyId,
      kind: 'benefit' as const,
      name: '初回来店ドリンク1杯',
      display_name: 'ドリンク1杯サービス',
      content: 'お好きなドリンクを1杯サービスします',
      description: '初めてのご来店ありがとうございます。',
      terms: '他のクーポンとの併用はできません。',
      image_url: null,
      starts_at: '2026-09-01T00:00:00+09:00',
      ends_at: null,
      valid_days: 30,
      discount_type_id: null,
      menu_id: null,
    },
    {
      id: `${companyId}-coupon-2`,
      company_id: companyId,
      kind: 'discount' as const,
      name: '10%OFF',
      display_name: 'お会計10%OFF',
      content: 'お会計から10%割引します',
      description: null,
      terms: '3,000円以上のご利用が対象です。',
      image_url: null,
      starts_at: '2026-09-01T00:00:00+09:00',
      ends_at: `2026-1${index}-31T23:59:59+09:00`,
      valid_days: null,
      discount_type_id: null,
      menu_id: null,
    },
  ]);

  const lineAccounts: LineOfficialAccount[] = companyIds.map((companyId, index) => ({
    id: `${companyId}-line`,
    company_id: companyId,
    name: index === 0 ? '炭火焼き デモ公式' : '海鮮スタンド デモ公式',
    channel_id: `1660${index}00000`,
    monthly_quota: 5000,
    friends_total: 1200 + index * 300,
    friends_active: 980 + index * 220,
    blocked: 120 + index * 30,
  }));

  const messageDeliveries: MessageDelivery[] = companyIds.flatMap((companyId) => [
    {
      id: `${companyId}-md-1`,
      company_id: companyId,
      line_account_id: `${companyId}-line`,
      name: '週末クーポン配信',
      status: 'reserved' as const,
      target_type: 'filtered' as const,
      filter: { visitCountFrom: 2, daysSinceVisitTo: 60 },
      target_count: 420,
      max_count: 1000,
      target_updated_at: '2026-09-18T10:00:00+09:00',
      scheduled_at: '2026-09-20T11:00:00+09:00',
      repeat_daily: false,
    },
    {
      id: `${companyId}-md-2`,
      company_id: companyId,
      line_account_id: `${companyId}-line`,
      name: '休眠のお客様への再来店のご案内',
      status: 'draft' as const,
      target_type: 'filtered' as const,
      filter: { daysSinceVisitFrom: 60 },
      target_count: 180,
      max_count: null,
      target_updated_at: null,
      scheduled_at: null,
      repeat_daily: false,
    },
  ]);

  const membershipRanks: MembershipRank[] = companyIds.flatMap((companyId) =>
    [
      { name: 'レギュラー', visits: 1 },
      { name: 'シルバー', visits: 3 },
      { name: 'ゴールド', visits: 7 },
      { name: 'プラチナ', visits: 13 },
    ].map((rank, index) => ({
      id: `${companyId}-rank-${index}`,
      company_id: companyId,
      name: rank.name,
      min_visits: rank.visits,
      coupon_id: null,
      display_order: (index + 1) * 10,
    }))
  );

  const couponPresets: CouponPreset[] = companyIds.flatMap((companyId) =>
    ['new', 'repeat2', 'dormant', 'vip'].map((segment, index) => ({
      id: `${companyId}-preset-${segment}`,
      company_id: companyId,
      segment,
      enabled: index === 0,
      coupon_id: index === 0 ? `${companyId}-coupon-1` : null,
    }))
  );

  const miniGames: MiniGame[] = companyIds.map((companyId) => ({
    id: `${companyId}-game`,
    company_id: companyId,
    name: 'お会計後のくじ引き',
    enabled: false,
    shop_ids: [],
    time_from_min: 17 * 60,
    time_to_min: 23 * 60,
    win_rate: 0.1,
    win_coupon_id: `${companyId}-coupon-2`,
    lose_coupon_id: `${companyId}-coupon-1`,
  }));

  // アンケートは店舗ごとに 40 件ずつ。店舗によって少し傾向を変える
  const questionnaireAnswers: QuestionnaireAnswer[] = shopIds.flatMap((shopId, shopIndex) =>
    Array.from({ length: 40 }).map((_, i) => {
      const base = 3.6 + shopIndex * 0.25;
      const score = () => Math.max(1, Math.min(5, Math.round(base + (random() - 0.5) * 2)));

      return {
        id: `${shopId}-q-${i}`,
        shop_id: shopId,
        customer_id: `cust-${Math.floor(random() * customers.length)}`,
        answered_at: `2026-09-${String(1 + Math.floor(random() * 18)).padStart(2, '0')}T21:00:00+09:00`,
        revisit_score: score(),
        service_score: score(),
        food_score: score(),
        speed_score: score(),
        clean_score: score(),
        comment: random() > 0.6 ? COMMENTS[Math.floor(random() * COMMENTS.length)] : null,
        gender: genders[Math.floor(random() * genders.length)],
        age: 20 + Math.floor(random() * 5) * 10,
        awareness_channel: CHANNELS[Math.floor(random() * CHANNELS.length)],
      };
    })
  );

  const menuReviews: MenuReview[] = menuIds.flatMap((menuId) =>
    Array.from({ length: 1 + Math.floor(random() * 4) }).map((_, i) => ({
      id: `${menuId}-review-${i}`,
      menu_id: menuId,
      shop_id: shopIds[Math.floor(random() * shopIds.length)] ?? shopIds[0],
      customer_id: `cust-${Math.floor(random() * customers.length)}`,
      score: 3 + Math.floor(random() * 3),
      tags: REVIEW_TAGS.filter(() => random() > 0.6),
      comment: random() > 0.5 ? COMMENTS[Math.floor(random() * COMMENTS.length)] : null,
      reviewed_at: `2026-09-${String(1 + Math.floor(random() * 18)).padStart(2, '0')}T21:30:00+09:00`,
    }))
  );

  const employeeReviews: EmployeeReview[] = shopIds.flatMap((shopId) =>
    (clerkIdsByShop[shopId] ?? []).flatMap((clerkId) =>
      Array.from({ length: 5 + Math.floor(random() * 10) }).map((_, i) => ({
        id: `${clerkId}-er-${i}`,
        clerk_id: clerkId,
        shop_id: shopId,
        customer_id: `cust-${Math.floor(random() * customers.length)}`,
        is_good: random() > 0.25,
        comment: random() > 0.7 ? COMMENTS[Math.floor(random() * COMMENTS.length)] : null,
        reviewed_at: `2026-09-${String(1 + Math.floor(random() * 18)).padStart(2, '0')}T21:30:00+09:00`,
      }))
    )
  );

  return {
    customers,
    lineAccounts,
    coupons,
    couponPresets,
    messageDeliveries,
    miniGames,
    membershipRanks,
    questionnaireAnswers,
    menuReviews,
    employeeReviews,
    shopQuestionnaireSettings: shopIds.map((shopId) => ({
      shop_id: shopId,
      menu_review_enabled: true,
      staff_review_enabled: true,
    })),
  };
}
