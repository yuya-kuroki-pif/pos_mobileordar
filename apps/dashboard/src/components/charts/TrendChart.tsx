'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_COLORS } from '@/styles/theme';

const PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.quaternary,
  '#722ed1',
  CHART_COLORS.muted,
];

export interface TrendSeries {
  key: string;
  label: string;
}

/**
 * 何本かの線を重ねるだけの折れ線。
 * スコア推移のように「同じ軸の指標を並べて比べる」画面で使う。
 */
export function TrendChart({
  data,
  series,
  height = 300,
  domain,
  unit = '',
}: {
  data: Record<string, string | number>[];
  series: TrendSeries[];
  height?: number;
  /** 点数のように上限が決まっているときに渡す */
  domain?: [number, number];
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          domain={domain ?? ['auto', 'auto']}
        />
        <Tooltip
          formatter={(value: number, name: string) => [`${value}${unit}`, name]}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((item, index) => (
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.label}
            stroke={PALETTE[index % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
