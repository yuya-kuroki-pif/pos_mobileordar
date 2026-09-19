import type { OrderItemStatus, PaymentMethod, PrepStation, SessionStatus } from './types';

const yen = new Intl.NumberFormat('ja-JP');

/** 1580 -> "¥1,580" */
export function formatYen(amount: number): string {
  return `¥${yen.format(Math.round(amount))}`;
}

/** 1580 -> "1,580"（記号なし。入力欄や表内で使う） */
export function formatNumber(amount: number): string {
  return yen.format(Math.round(amount));
}

const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
});

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
});

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/**
 * 経過時間を「12分」「1時間5分」の形で返す。
 * 卓の滞在時間や、KDS での調理待ち時間の表示に使う。
 */
export function elapsedLabel(fromIso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

/** 経過分数。KDS の「遅れている注文」を赤く出す判定に使う */
export function elapsedMinutes(fromIso: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));
}

export const ORDER_ITEM_STATUS_LABEL: Record<OrderItemStatus, string> = {
  pending: '未調理',
  cooking: '調理中',
  ready: '提供待ち',
  served: '提供済み',
  cancelled: 'キャンセル',
};

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  open: '利用中',
  bill_requested: 'お会計希望',
  closed: '会計済み',
  cancelled: '取消',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: '現金',
  card: 'クレジットカード',
  qr: 'QR決済',
  e_money: '電子マネー',
  other: 'その他',
};

export const PREP_STATION_LABEL: Record<PrepStation, string> = {
  kitchen: 'キッチン',
  bar: 'ドリンク',
  none: 'その他',
};

/** 営業日（Asia/Tokyo、店舗の区切り時刻を考慮）を YYYY-MM-DD で返す */
export function businessDate(
  at: Date = new Date(),
  timezone = 'Asia/Tokyo',
  cutoffHour = 5
): string {
  // タイムゾーン変換を Intl に任せ、そのうえで区切り時刻ぶん巻き戻す
  const local = new Date(at.toLocaleString('en-US', { timeZone: timezone }));
  local.setHours(local.getHours() - cutoffHour);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const d = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "2026-09-19" -> "9/19(金)" */
export function formatBusinessDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${m}/${d}(${weekday})`;
}
