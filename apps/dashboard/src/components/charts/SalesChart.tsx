'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_COLORS } from '@/styles/theme';

const yen = new Intl.NumberFormat('ja-JP');

export interface SalesPoint {
  label: string;
  sales: number;
  target?: number;
  lastYear?: number;
}

/**
 * 売上の推移（仕様書 §6.4）。
 * 実績を塗りつぶしの面、目標を破線、前年を細い線で重ねる。
 */
export function SalesChart({ data, height = 300 }: { data: SalesPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) =>
            value >= 10000 ? `${Math.round(value / 10000)}万` : yen.format(value)
          }
        />
        <Tooltip
          formatter={(value: number, name: string) => [`¥${yen.format(value)}`, name]}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          name="売上"
          stroke={CHART_COLORS.primary}
          fill={CHART_COLORS.primary}
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="target"
          name="目標"
          stroke={CHART_COLORS.target}
          strokeDasharray="4 4"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="lastYear"
          name="前年"
          stroke={CHART_COLORS.muted}
          strokeWidth={1}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
