/**
 * 営業日とレジ精算単位（追補 §A.5）。
 *
 * この 2 つは別物で、画面ごとにどちらを使うかが決まっている。
 * - 営業日基準: 分析・経営管理・日報・CRM 系
 * - レジ精算単位: レジ内の売上表示・精算伝票・POS 系 CSV
 *
 * 取引には両方を持たせておき、画面側では選ぶだけにする。
 */

/** 営業日変更時刻の既定（追補 §A.5.1。本編の 05:00 を置き換える） */
export const DEFAULT_BUSINESS_DAY_START = '07:00';

/**
 * その時刻がどの営業日に属するか。
 * 変更時刻より前なら前日の営業日になる。
 *
 * @param at 判定したい時刻
 * @param startTime 営業日変更時刻（'07:00' 形式）
 * @param timeZone 店舗のタイムゾーン
 */
export function businessDateOf(
  at: Date,
  startTime: string = DEFAULT_BUSINESS_DAY_START,
  timeZone = 'Asia/Tokyo'
): string {
  // 店舗のタイムゾーンでの年月日と時分を取り出す
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startMinutes = startHour * 60 + (startMinute ?? 0);

  // 変更時刻より前は前日扱い。月またぎは Date に任せる
  const date = new Date(Date.UTC(year, month - 1, day));
  if (minutes < startMinutes) date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

/** 営業時間帯は固定 6 区分。名称の変更も追加もできない（追補 §A.5.1） */
export type BusinessHourKind =
  | 'morning'
  | 'lunch'
  | 'cafe'
  | 'happy_hour'
  | 'dinner'
  | 'late_night';

export const BUSINESS_HOUR_LABELS: Record<BusinessHourKind, string> = {
  morning: 'モーニング',
  lunch: 'ランチ',
  cafe: 'カフェ',
  happy_hour: 'ハッピーアワー',
  dinner: 'ディナー',
  late_night: '深夜',
};

export const BUSINESS_HOUR_KINDS: BusinessHourKind[] = [
  'morning',
  'lunch',
  'cafe',
  'happy_hour',
  'dinner',
  'late_night',
];

/**
 * 卓の立ち上げ時刻がどの営業時間帯に入るか（追補 §A.5.1）。
 * 開始時刻は以上、終了時刻は直前まで。判定は入店時刻で行う。
 */
export function businessHourOf(
  enteredAtMinutes: number,
  hours: { kind: BusinessHourKind; startMin: number; endMin: number }[]
): BusinessHourKind | null {
  const found = hours.find(
    (h) => enteredAtMinutes >= h.startMin && enteredAtMinutes < h.endMin
  );
  return found?.kind ?? null;
}
