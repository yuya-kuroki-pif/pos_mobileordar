/**
 * カスタムレポート（§6.9）の選択肢。
 *
 * 'use server' のファイルは async 関数しか export できないので、
 * 定数はこちらに置いてクライアントから読めるようにする。
 */

export const REPORT_SOURCES = {
  sales: '売上',
  menu: 'メニュー',
  survey: 'アンケート',
} as const;

export const REPORT_METRICS: Record<string, { label: string; source: string }> = {
  sales: { label: '売上', source: 'sales' },
  guests: { label: '客数', source: 'sales' },
  groups: { label: '組数', source: 'sales' },
  avgSpend: { label: '客単価', source: 'sales' },
  qty: { label: '出数', source: 'menu' },
  menuSales: { label: '売上', source: 'menu' },
  grossProfit: { label: '粗利', source: 'menu' },
  answers: { label: '回答数', source: 'survey' },
  average: { label: '総合スコア', source: 'survey' },
  revisit: { label: '再来店意欲', source: 'survey' },
};
