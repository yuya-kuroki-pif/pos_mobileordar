import 'server-only';

import type { EmployeeReview, MenuReview, QuestionnaireAnswer } from './types';

/** アンケート分析の計算（仕様書 §5.32） */

export type ScoreRank = 'S' | 'A' | 'B' | 'C' | 'D';

/** 100 点換算のスコアをランクに直す */
export function rankOf(score: number): ScoreRank {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

export const RANK_COLOR: Record<ScoreRank, string> = {
  S: 'magenta',
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

export interface ShopScore {
  shop_id: string;
  answers: number;
  revisit: number;
  service: number;
  food: number;
  speed: number;
  clean: number;
  average: number;
}

/** 5 段階の平均を 100 点換算にする */
function to100(values: (number | null)[]): number {
  const list = values.filter((v): v is number => v !== null);
  if (list.length === 0) return 0;
  const average = list.reduce((sum, v) => sum + v, 0) / list.length;
  return Math.round((average / 5) * 100);
}

export function scoreByShop(answers: QuestionnaireAnswer[]): ShopScore[] {
  const byShop = new Map<string, QuestionnaireAnswer[]>();
  for (const answer of answers) {
    byShop.set(answer.shop_id, [...(byShop.get(answer.shop_id) ?? []), answer]);
  }

  return [...byShop.entries()]
    .map(([shopId, rows]) => {
      const revisit = to100(rows.map((r) => r.revisit_score));
      const service = to100(rows.map((r) => r.service_score));
      const food = to100(rows.map((r) => r.food_score));
      const speed = to100(rows.map((r) => r.speed_score));
      const clean = to100(rows.map((r) => r.clean_score));

      return {
        shop_id: shopId,
        answers: rows.length,
        revisit,
        service,
        food,
        speed,
        clean,
        average: Math.round((revisit + service + food + speed + clean) / 5),
      };
    })
    .sort((a, b) => b.average - a.average);
}

/** 回答者の内訳（§5.32 の店舗詳細） */
export function breakdown(answers: QuestionnaireAnswer[]) {
  const count = <T extends string | number>(values: (T | null)[]) => {
    const map = new Map<T, number>();
    for (const value of values) {
      if (value === null) continue;
      map.set(value, (map.get(value) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  return {
    byGender: count(answers.map((a) => a.gender)),
    byAge: count(answers.map((a) => a.age)),
    byChannel: count(answers.map((a) => a.awareness_channel)),
  };
}

/** スタッフ評価のランキング（§5.32） */
export interface ClerkScore {
  clerk_id: string;
  good: number;
  bad: number;
  comments: number;
}

export function rankClerks(reviews: EmployeeReview[]): ClerkScore[] {
  const byClerk = new Map<string, ClerkScore>();

  for (const review of reviews) {
    const row =
      byClerk.get(review.clerk_id) ??
      { clerk_id: review.clerk_id, good: 0, bad: 0, comments: 0 };

    if (review.is_good) row.good += 1;
    else row.bad += 1;
    if (review.comment) row.comments += 1;

    byClerk.set(review.clerk_id, row);
  }

  return [...byClerk.values()].sort((a, b) => b.good - a.good);
}

/** メニュー評価の集計（§5.32） */
export interface MenuScore {
  menu_id: string;
  count: number;
  average: number;
  tags: [string, number][];
  comments: MenuReview[];
}

export function scoreMenus(reviews: MenuReview[]): MenuScore[] {
  const byMenu = new Map<string, MenuReview[]>();
  for (const review of reviews) {
    byMenu.set(review.menu_id, [...(byMenu.get(review.menu_id) ?? []), review]);
  }

  return [...byMenu.entries()]
    .map(([menuId, rows]) => {
      const tagCount = new Map<string, number>();
      for (const row of rows) {
        for (const tag of row.tags) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      }

      return {
        menu_id: menuId,
        count: rows.length,
        average: rows.reduce((sum, r) => sum + r.score, 0) / rows.length,
        tags: [...tagCount.entries()].sort((a, b) => b[1] - a[1]),
        comments: rows.filter((r) => r.comment),
      };
    })
    .sort((a, b) => b.average - a.average || b.count - a.count);
}

export interface MonthlyScore {
  month: string;
  answers: number;
  revisit: number;
  service: number;
  food: number;
  speed: number;
  clean: number;
  average: number;
}

/** スコア推移（§5.32）。月ごとに 100 点換算でまとめる */
export function scoreByMonth(answers: QuestionnaireAnswer[]): MonthlyScore[] {
  const byMonth = new Map<string, QuestionnaireAnswer[]>();
  for (const answer of answers) {
    const month = answer.answered_at.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), answer]);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rows]) => {
      const revisit = to100(rows.map((r) => r.revisit_score));
      const service = to100(rows.map((r) => r.service_score));
      const food = to100(rows.map((r) => r.food_score));
      const speed = to100(rows.map((r) => r.speed_score));
      const clean = to100(rows.map((r) => r.clean_score));

      return {
        month,
        answers: rows.length,
        revisit,
        service,
        food,
        speed,
        clean,
        average: Math.round((revisit + service + food + speed + clean) / 5),
      };
    });
}

export interface QscRow {
  shop_id: string;
  reviews: number;
  good_rate: number;
  service: number;
  food: number;
  speed: number;
  clean: number;
}

/**
 * QSC 相関（§5.32）。
 * 店舗ごとに「スタッフの Good 率」と「アンケートの各スコア」を並べ、
 * どれと一緒に動いているかを見る。
 */
export function qscCorrelation(
  reviews: EmployeeReview[],
  answers: QuestionnaireAnswer[]
): { rows: QscRow[]; correlation: Record<'service' | 'food' | 'speed' | 'clean', number> } {
  const shopIds = [...new Set([...reviews.map((r) => r.shop_id), ...answers.map((a) => a.shop_id)])];

  const rows: QscRow[] = shopIds.map((shopId) => {
    const shopReviews = reviews.filter((r) => r.shop_id === shopId);
    const shopAnswers = answers.filter((a) => a.shop_id === shopId);
    const good = shopReviews.filter((r) => r.is_good).length;

    return {
      shop_id: shopId,
      reviews: shopReviews.length,
      good_rate:
        shopReviews.length === 0 ? 0 : Math.round((good / shopReviews.length) * 1000) / 10,
      service: to100(shopAnswers.map((a) => a.service_score)),
      food: to100(shopAnswers.map((a) => a.food_score)),
      speed: to100(shopAnswers.map((a) => a.speed_score)),
      clean: to100(shopAnswers.map((a) => a.clean_score)),
    };
  });

  const pick = (key: 'service' | 'food' | 'speed' | 'clean') =>
    pearson(
      rows.map((row) => row.good_rate),
      rows.map((row) => row[key])
    );

  return {
    rows,
    correlation: {
      service: pick('service'),
      food: pick('food'),
      speed: pick('speed'),
      clean: pick('clean'),
    },
  };
}

/** 相関係数。店舗数が少ないと当てにならないので、画面側で件数も出す */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;

  const meanX = xs.reduce((sum, v) => sum + v, 0) / n;
  const meanY = ys.reduce((sum, v) => sum + v, 0) / n;

  let top = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    top += dx * dy;
    sx += dx * dx;
    sy += dy * dy;
  }

  if (sx === 0 || sy === 0) return 0;
  return Math.round((top / Math.sqrt(sx * sy)) * 100) / 100;
}
