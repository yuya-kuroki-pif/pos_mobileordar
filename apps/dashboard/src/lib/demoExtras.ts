import 'server-only';

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

/**
 * 残りの画面ぶんのデモデータ。
 * 配信やクーポンの「実績」が無いと分析画面が空になってしまうので、
 * 他のデモデータと同じく決まった種から作る。
 */

export interface ExtrasState {
  questionnaires: Questionnaire[];
  questionnaireQuestions: QuestionnaireQuestion[];
  deliveryJobs: DeliveryJob[];
  customerCoupons: CustomerCoupon[];
  googleProfiles: GoogleBusinessProfile[];
  googleReviews: GoogleReview[];
  customReports: CustomReport[];
  accountAuditLogs: AccountAuditLog[];
}

function makeRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

/** 既定 27 問のうち、画面で形が分かるぶんだけ */
const DEFAULT_QUESTIONS: {
  text: string;
  type: QuestionnaireQuestion['type'];
  options?: string[];
}[] = [
  { text: 'またこのお店に来たいと思いますか？', type: 'score' },
  { text: 'スタッフの接客はいかがでしたか？', type: 'score' },
  { text: 'お料理の味はいかがでしたか？', type: 'score' },
  { text: 'お料理が出てくる速さはいかがでしたか？', type: 'score' },
  { text: '店内の清潔感はいかがでしたか？', type: 'score' },
  { text: '本日は何回目のご来店ですか？', type: 'choice', options: ['1回目', '2〜3回目', '4回目以上'] },
  { text: '性別を教えてください', type: 'choice', options: ['男性', '女性', 'その他', '回答しない'] },
  {
    text: '年代を教えてください',
    type: 'choice',
    options: ['10代', '20代', '30代', '40代', '50代', '60代以上'],
  },
  {
    text: 'このお店を知ったきっかけは？',
    type: 'multi_choice',
    options: ['通りがかり', '知人の紹介', 'Google検索', 'Googleマップ', '食べログ', 'Instagram'],
  },
  { text: 'ご意見・ご感想があればお聞かせください', type: 'text' },
];

const REVIEW_COMMENTS = [
  '接客がとても丁寧で、また来たいと思いました。',
  '料理は美味しかったですが、少し待ち時間が長かったです。',
  '雰囲気がよく、友人との食事にぴったりでした。',
  'Món ăn rất ngon, nhân viên thân thiện.',
  'コスパが良いです。次は家族と来ます。',
];

const AUTHORS = ['T. Yamada', 'M. Sato', 'K. Suzuki', 'Nguyen V.', 'A. Tanaka', 'R. Ito'];

export function buildExtras(input: {
  corporationId: string;
  companyIds: string[];
  shops: { id: string; company_id: string; name: string }[];
  deliveries: { id: string; company_id: string }[];
  coupons: { id: string; company_id: string }[];
  customerIds: string[];
  accounts: { id: string; name: string }[];
}): ExtrasState {
  const random = makeRandom(902611);
  const { corporationId, companyIds, shops, deliveries, coupons, customerIds, accounts } = input;

  // 固定日を起点にする。実行するたび中身が変わらないように。
  // 他のデモデータに合わせて、日本時間のまま文字列で持つ
  const dayOf = (back: number, hour = 12, minute = 0) => {
    const date = new Date(Date.parse('2026-09-19T00:00:00+09:00') - back * 86400000);
    const day = new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
    return `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
  };

  const questionnaires: Questionnaire[] = companyIds.flatMap((companyId) => [
    {
      id: `${companyId}-q-line`,
      company_id: companyId,
      kind: 'line' as const,
      name: 'ご来店アンケート（LINE）',
      image_url: null,
      reward_coupon_id: `${companyId}-coupon-1`,
    },
    {
      id: `${companyId}-q-mo`,
      company_id: companyId,
      kind: 'mobile_order' as const,
      name: 'モバイルオーダーアンケート',
      image_url: null,
      reward_coupon_id: null,
    },
  ]);

  const questionnaireQuestions: QuestionnaireQuestion[] = questionnaires.flatMap((q) =>
    DEFAULT_QUESTIONS.map((row, index) => ({
      id: `${q.id}-quest-${index}`,
      questionnaire_id: q.id,
      text: row.text,
      type: row.type,
      options: row.options ?? [],
      is_custom: false,
      display_order: (index + 1) * 10,
    }))
  );

  // 業態ごとに 1 問だけカスタム設問を足しておく（最大 5 問まで足せる）
  for (const q of questionnaires.filter((row) => row.kind === 'line')) {
    questionnaireQuestions.push({
      id: `${q.id}-quest-custom-0`,
      questionnaire_id: q.id,
      text: '本日担当したスタッフの名前を覚えていますか？',
      type: 'text',
      options: [],
      is_custom: true,
      display_order: 1000,
    });
  }

  // 1 配信につき直近 4 回ぶん、店舗ごとに結果を持たせる
  const deliveryJobs: DeliveryJob[] = [];
  for (const delivery of deliveries) {
    const targets = shops.filter((s) => s.company_id === delivery.company_id);
    for (let round = 0; round < 4; round += 1) {
      for (const shop of targets) {
        const sent = 60 + Math.floor(random() * 140);
        const opened = Math.floor(sent * (0.32 + random() * 0.3));
        const groups = Math.floor(opened * (0.08 + random() * 0.12));
        const visited = groups * (2 + Math.floor(random() * 2));
        deliveryJobs.push({
          id: `${delivery.id}-job-${round}-${shop.id}`,
          delivery_id: delivery.id,
          shop_id: shop.id,
          sent_at: dayOf(round * 7 + 1),
          sent_count: sent,
          opened_count: opened,
          visited_count: visited,
          visited_group_count: groups,
          effect_sales: visited * (3200 + Math.floor(random() * 2400)),
        });
      }
    }
  }

  const customerCoupons: CustomerCoupon[] = [];
  for (const coupon of coupons) {
    const targets = shops.filter((s) => s.company_id === coupon.company_id);
    if (targets.length === 0) continue;

    for (let i = 0; i < 60; i += 1) {
      const used = random() > 0.55;
      const shop = targets[Math.floor(random() * targets.length)];
      const issuedBack = 5 + Math.floor(random() * 25);
      customerCoupons.push({
        id: `${coupon.id}-cc-${i}`,
        coupon_id: coupon.id,
        customer_id: customerIds[Math.floor(random() * customerIds.length)] ?? 'cust-0',
        issued_at: dayOf(issuedBack),
        used_at: used ? dayOf(Math.max(0, issuedBack - 1 - Math.floor(random() * 4))) : null,
        used_shop_id: used ? shop.id : null,
        effect_sales: used ? 4200 + Math.floor(random() * 6800) : 0,
      });
    }
  }

  // 連携はまだなので既定は全店 is_connected = false。
  // それでも画面が空にならないよう、取り込み済みのクチコミだけ用意しておく
  const googleProfiles: GoogleBusinessProfile[] = shops.map((shop) => ({
    shop_id: shop.id,
    location_id: null,
    account_name: null,
    is_connected: false,
    synced_at: null,
  }));

  const googleReviews: GoogleReview[] = shops.flatMap((shop) =>
    Array.from({ length: 12 }).map((_, i) => {
      const replied = random() > 0.45;
      const postedBack = Math.floor(random() * 28);
      return {
        id: `${shop.id}-greview-${i}`,
        shop_id: shop.id,
        review_id: null,
        author_name: AUTHORS[Math.floor(random() * AUTHORS.length)],
        rating: 3 + Math.floor(random() * 3),
        comment: REVIEW_COMMENTS[Math.floor(random() * REVIEW_COMMENTS.length)],
        posted_at: dayOf(postedBack),
        reply_text: replied
          ? 'ご来店ありがとうございました。またのお越しをお待ちしております。'
          : null,
        replied_at: replied ? dayOf(Math.max(0, postedBack - 1)) : null,
      };
    })
  );

  const customReports: CustomReport[] = [
    {
      id: 'report-1',
      corporation_id: corporationId,
      name: '店舗別 売上と客単価（月次）',
      owner_account_id: accounts[0]?.id ?? null,
      owner_name: accounts[0]?.name ?? null,
      share_scope: 'corporation',
      definition: {
        source: 'sales',
        metrics: ['sales', 'guests', 'avgSpend'],
        group_by: 'shop',
        shop_ids: shops.map((s) => s.id),
      },
      updated_at: dayOf(3),
    },
    {
      id: 'report-2',
      corporation_id: corporationId,
      name: '売れ筋メニュー トップ20',
      owner_account_id: accounts[0]?.id ?? null,
      owner_name: accounts[0]?.name ?? null,
      share_scope: 'private',
      definition: { source: 'menu', metrics: ['qty', 'sales'], group_by: 'menu', shop_ids: [] },
      updated_at: dayOf(9),
    },
  ];

  const ACTIONS = ['login', 'menu_update', 'shop_update', 'role_update', 'export', 'account_invite'];
  const accountAuditLogs: AccountAuditLog[] = Array.from({ length: 80 }).map((_, i) => {
    const account = accounts[Math.floor(random() * Math.max(1, accounts.length))];
    const action = ACTIONS[Math.floor(random() * ACTIONS.length)];
    const shopName = shops[Math.floor(random() * shops.length)]?.name ?? '';
    return {
      id: `aal-${i}`,
      corporation_id: corporationId,
      account_id: account?.id ?? null,
      account_name: account?.name ?? null,
      action,
      target:
        action === 'menu_update'
          ? 'メニュー / 炭火焼き鳥 もも'
          : action === 'shop_update'
            ? `店舗 / ${shopName}`
            : action === 'role_update'
              ? '権限設定 / 店舗管理者'
              : null,
      occurred_at: dayOf(
        Math.floor(random() * 30),
        9 + Math.floor(random() * 12),
        Math.floor(random() * 60)
      ),
      ip: `203.0.113.${1 + Math.floor(random() * 250)}`,
    };
  });

  return {
    questionnaires,
    questionnaireQuestions,
    deliveryJobs,
    customerCoupons,
    googleProfiles,
    googleReviews,
    customReports,
    accountAuditLogs,
  };
}
