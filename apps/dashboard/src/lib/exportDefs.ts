/**
 * CSV ダウンロード（§5.28）の出力ファイル一覧。
 *
 * 'use server' のファイルは async 関数しか export できず、定数を置くと
 * クライアントから読めない（画面では空の配列になる）。そのためここに分けている。
 */

export type ExportKind =
  | 'summaryByShops'
  | 'summary'
  | 'orders'
  | 'orderSummary'
  | 'payments'
  | 'discounts'
  | 'customerSource'
  | 'audit';

export const EXPORT_LABELS: Record<ExportKind, string> = {
  summaryByShops: '日計（日別・店舗統一） summaryByShops.csv',
  summary: '日計（日別） summary.csv',
  orders: '注文一覧 orders.csv',
  orderSummary: '出数集計 orderSummary.csv',
  payments: '支払一覧 payments.csv',
  discounts: '値引・割引一覧 discounts.csv',
  customerSource: '媒体集計 customerSource.csv',
  audit: '監査 audit.csv',
};
