/**
 * 営業時間の表記（仕様書 §5.12）。
 *
 * 深夜営業を素直に書けるように、時刻は「0:00 からの分」で持つ。
 * 1440 以上は翌日を指し、31:00（＝翌 7:00）のように 24 時を超えた形で見せる。
 */

/** 1860 → "31:00" */
export function minToLabel(min: number | null | undefined): string {
  if (min === null || min === undefined) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "31:00" → 1860。読めなければ null */
export function labelToMin(label: string | null | undefined): number | null {
  if (!label) return null;
  const matched = /^(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!matched) return null;

  const h = Number(matched[1]);
  const m = Number(matched[2]);
  if (m > 59) return null;

  const min = h * 60 + m;
  return min >= 0 && min <= 1860 ? min : null;
}

/** 営業時間の範囲表示。片方でも欠けていたら null */
export function rangeLabel(from: number | null, to: number | null): string | null {
  if (from === null || to === null) return null;
  return `${minToLabel(from)} 〜 ${minToLabel(to)}`;
}
