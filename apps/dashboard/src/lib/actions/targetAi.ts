'use server';

import { askJson, isAiConfigured } from '../anthropic';
import { requireSession } from '../auth';
import { getShopSummaries, monthRange } from '../analyticsQueries';
import { canEdit } from '../permissions';

/**
 * 目標の AI 一括（仕様書 §6.7 の「AIで一括インポート (β)」）。
 *
 * 過去の実績を渡して、来月の目標の目安を出してもらう。
 * 返ってきた数字はそのまま保存せず、画面のフォームに入れるだけにしている。
 * 目標は人が決めるものなので、最後は必ず人が確かめる。
 */

export interface SuggestedTarget {
  sales_target: number;
  food_cost_target: number;
  drink_cost_target: number;
  labor_target: number;
  sga_target: number;
  guest_target: number;
  avg_spend_target: number;
  reason: string;
}

export interface SuggestResult {
  ok: boolean;
  error?: string;
  suggestion?: SuggestedTarget;
}

export async function suggestKpiTargetAction(
  shopId: string,
  yearMonth: string
): Promise<SuggestResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'target_management')) {
      return { ok: false, error: '目標を編集する権限がありません。' };
    }
    const shop = session.shops.find((row) => row.id === shopId);
    if (!shop) return { ok: false, error: '店舗が見つかりません。' };

    if (!isAiConfigured()) {
      return {
        ok: false,
        error:
          'ANTHROPIC_API_KEY が設定されていません。設定すると、過去の実績から目標の目安を出せます。',
      };
    }

    // 直近 6 ヶ月の実績を渡す
    const months: { month: string; sales: number; guests: number; groups: number }[] = [];
    const base = new Date(`${yearMonth}-01T00:00:00+09:00`);

    for (let back = 6; back >= 1; back -= 1) {
      const date = new Date(base);
      date.setMonth(date.getMonth() - back);
      const month = date.toISOString().slice(0, 7);

      const summaries = await getShopSummaries([shopId], monthRange(month));
      const summary = summaries.find((row) => row.shop_id === shopId);
      months.push({
        month,
        sales: summary?.sales ?? 0,
        guests: summary?.guest_count ?? 0,
        groups: summary?.group_count ?? 0,
      });
    }

    if (months.every((row) => row.sales === 0)) {
      return { ok: false, error: '過去の実績がないため、目安を出せません。' };
    }

    const system = [
      'あなたは飲食店の予算を組む人です。過去の実績から、翌月の目標の目安を出します。',
      '',
      '守ること:',
      '- 渡された実績だけを根拠にすること。季節要因は月の並びから読み取れる範囲で考えること。',
      '- 無理な数字を置かないこと。直近の傾向から大きく外れた目標は、現場が諦めてしまう。',
      '- 原価は売上の 28〜33%、人件費は 25〜30%、販売管理費は 15〜20% を目安にし、',
      '  実績がその範囲から外れているなら実績側に寄せること。',
      '- 金額はすべて税抜・円の整数で返すこと。',
      '- reason には「なぜこの数字にしたか」を 2 文以内の日本語で書くこと。',
      '',
      'JSON だけを返すこと。形式:',
      '{"sales_target":0,"food_cost_target":0,"drink_cost_target":0,"labor_target":0,',
      ' "sga_target":0,"guest_target":0,"avg_spend_target":0,"reason":"..."}',
    ].join('\n');

    const prompt = [
      `店舗: ${shop.name}`,
      `目標を立てる月: ${yearMonth}`,
      '',
      '過去の実績（税込の会計金額）:',
      ...months.map(
        (row) =>
          `${row.month}: 売上 ${row.sales.toLocaleString()}円 / 客数 ${row.guests.toLocaleString()}名 / 組数 ${row.groups.toLocaleString()}組`
      ),
    ].join('\n');

    const suggestion = await askJson<SuggestedTarget>({ system, prompt, maxTokens: 1000 });

    // 数字として読めないものが混ざっても画面を壊さないようにする
    const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));

    return {
      ok: true,
      suggestion: {
        sales_target: num(suggestion.sales_target),
        food_cost_target: num(suggestion.food_cost_target),
        drink_cost_target: num(suggestion.drink_cost_target),
        labor_target: num(suggestion.labor_target),
        sga_target: num(suggestion.sga_target),
        guest_target: num(suggestion.guest_target),
        avg_spend_target: num(suggestion.avg_spend_target),
        reason: String(suggestion.reason ?? ''),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '目安を出せませんでした' };
  }
}
