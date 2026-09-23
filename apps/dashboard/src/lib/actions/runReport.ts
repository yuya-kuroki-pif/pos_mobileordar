'use server';

import {
  getMenuSummaries,
  getShopSummaries,
  monthRange,
} from '../analyticsQueries';
import { requireSession } from '../auth';
import { getQuestionnaireAnswers } from '../crmQueries';
import { REPORT_METRICS } from '../reportDefs';
import { scoreByShop } from '../surveyAnalytics';

/** 保存したカスタムレポートを実際に走らせる（仕様書 §6.9） */

export interface ReportResult {
  ok: boolean;
  error?: string;
  columns?: { key: string; label: string }[];
  rows?: Record<string, string | number>[];
}

export async function runCustomReportAction(
  definition: {
    source: 'sales' | 'menu' | 'survey';
    metrics: string[];
    group_by: string;
    shop_ids: string[];
  },
  yearMonth: string
): Promise<ReportResult> {
  try {
    const session = await requireSession();

    const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
    const scope =
      definition.shop_ids.length > 0
        ? shops.filter((s) => definition.shop_ids.includes(s.id))
        : shops;
    if (scope.length === 0) return { ok: false, error: '対象の店舗がありません。' };

    const shopIds = scope.map((s) => s.id);
    const range = monthRange(yearMonth);
    const shopName = new Map(scope.map((s) => [s.id, s.name]));

    const pick = (row: Record<string, string | number>): Record<string, string | number> => ({
      label: row.label,
      ...Object.fromEntries(definition.metrics.map((metric) => [metric, row[metric] ?? 0])),
    });

    let rows: Record<string, string | number>[] = [];
    let firstLabel = '店舗';

    if (definition.source === 'sales') {
      const summaries = await getShopSummaries(shopIds, range);
      rows = summaries.map((summary) =>
        pick({
          label: shopName.get(summary.shop_id) ?? summary.shop_id,
          sales: summary.sales,
          guests: summary.guest_count,
          groups: summary.group_count,
          avgSpend:
            summary.guest_count === 0 ? 0 : Math.round(summary.sales / summary.guest_count),
        })
      );
    } else if (definition.source === 'menu') {
      firstLabel = definition.group_by === 'category' ? 'カテゴリ' : 'メニュー';
      const menus = await getMenuSummaries(shopIds, range, session.currentCompanyId);

      const acc = new Map<string, { qty: number; menuSales: number; grossProfit: number }>();
      for (const menu of menus) {
        const key =
          definition.group_by === 'category' ? (menu.category_name ?? '未設定') : menu.name;
        const current = acc.get(key) ?? { qty: 0, menuSales: 0, grossProfit: 0 };
        current.qty += menu.qty;
        current.menuSales += menu.sales;
        current.grossProfit += menu.gross_profit;
        acc.set(key, current);
      }

      rows = [...acc.entries()]
        .map(([label, value]) => pick({ label, ...value }))
        .sort((a, b) => Number(b[definition.metrics[0]] ?? 0) - Number(a[definition.metrics[0]] ?? 0));
    } else {
      const answers = await getQuestionnaireAnswers(shopIds);
      rows = scoreByShop(answers).map((score) =>
        pick({
          label: shopName.get(score.shop_id) ?? score.shop_id,
          answers: score.answers,
          average: score.average,
          revisit: score.revisit,
        })
      );
    }

    return {
      ok: true,
      columns: [
        { key: 'label', label: firstLabel },
        ...definition.metrics.map((metric) => ({
          key: metric,
          label: REPORT_METRICS[metric]?.label ?? metric,
        })),
      ],
      rows,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'レポートを実行できませんでした' };
  }
}
