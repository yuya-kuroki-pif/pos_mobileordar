'use client';

import { useRouter } from 'next/navigation';

/** 期間のプリセット。日々の確認でよく使う区切りだけを並べる */
const PRESETS = [
  { label: '本日', days: 0 },
  { label: '7日間', days: 6 },
  { label: '30日間', days: 29 },
  { label: '90日間', days: 89 },
];

function shiftDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function RangePicker({
  from,
  to,
  today,
}: {
  from: string;
  to: string;
  today: string;
}) {
  const router = useRouter();

  function apply(nextFrom: string, nextTo: string) {
    router.push(`/admin/sales?from=${nextFrom}&to=${nextTo}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="no-select flex gap-2">
        {PRESETS.map((preset) => {
          const presetFrom = shiftDays(today, -preset.days);
          const active = from === presetFrom && to === today;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => apply(presetFrom, today)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                active ? 'bg-charcoal-900 text-white' : 'bg-white text-charcoal-600 hover:bg-charcoal-100'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-end gap-2">
        <label className="text-xs font-semibold text-charcoal-500">
          開始
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => apply(e.target.value, to)}
            className="tabular mt-1 block rounded-xl border border-charcoal-200 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-ember-400"
          />
        </label>
        <label className="text-xs font-semibold text-charcoal-500">
          終了
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => apply(from, e.target.value)}
            className="tabular mt-1 block rounded-xl border border-charcoal-200 px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-ember-400"
          />
        </label>
      </div>
    </div>
  );
}
