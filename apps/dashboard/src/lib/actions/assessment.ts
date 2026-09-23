'use server';

import { requireSession } from '../auth';
import { askJson, isAiConfigured } from '../anthropic';

/** AI 店舗診断のコメント生成（仕様書 §7.1） */

export interface AssessmentInput {
  name: string;
  sales: number;
  sales_rate: number;
  guests: number;
  avg_spend: number;
  revisit: number;
  service: number;
  food: number;
  speed: number;
  clean: number;
}

export interface AssessmentResult {
  ok: boolean;
  error?: string;
  /** 店舗名 → 診断コメント */
  comments?: Record<string, string>;
}

export async function generateAssessmentAction(
  shops: AssessmentInput[],
  yearMonth: string
): Promise<AssessmentResult> {
  try {
    await requireSession();

    if (!isAiConfigured()) {
      return {
        ok: false,
        error:
          'ANTHROPIC_API_KEY が設定されていません。設定すると、数字を読んだ診断コメントが出せます。',
      };
    }
    if (shops.length === 0) return { ok: false, error: '対象の店舗がありません。' };

    const system = [
      'あなたは飲食チェーンの本部で、店舗の数字を読んで助言する人です。',
      '',
      '守ること:',
      '- 渡された数字だけを根拠にすること。無い数字を作らないこと。',
      '- 店舗ごとに、強み 1 つ・弱み 1 つ・明日からできる打ち手 1 つを、合わせて 3 文以内で書くこと。',
      '- 数字を挙げるときは、渡された値をそのまま使うこと。',
      '- 精神論ではなく、店舗で実際に動かせることを書くこと。',
      '- 日本語で、現場のスタッフが読んで分かる言葉で書くこと。',
      '',
      'JSON だけを返すこと。形式: {"店舗名": "コメント", ...}',
    ].join('\n');

    const prompt = [
      `${yearMonth} の実績です。スコアは 100 点換算です。`,
      '',
      ...shops.map((shop) =>
        [
          `## ${shop.name}`,
          `売上 ${shop.sales.toLocaleString()}円（目標達成率 ${shop.sales_rate.toFixed(0)}%）`,
          `客数 ${shop.guests.toLocaleString()}名 / 客単価 ${shop.avg_spend.toLocaleString()}円`,
          `再来店意欲 ${shop.revisit} / 接客 ${shop.service} / 料理 ${shop.food} / 提供速度 ${shop.speed} / 清潔感 ${shop.clean}`,
        ].join('\n')
      ),
    ].join('\n\n');

    const comments = await askJson<Record<string, string>>({ system, prompt, maxTokens: 2000 });
    return { ok: true, comments };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '診断コメントを作れませんでした' };
  }
}
