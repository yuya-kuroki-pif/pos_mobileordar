'use client';

import { Card, DatePicker, Flex, Radio, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import type { HourlySummary, Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');
const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

type Metric = 'sales' | 'guests' | 'average';

/**
 * 曜日・時間別分析（仕様書 §6.9）。
 * 濃いほど数字が大きい。1 マスは「その曜日・その時間の 1 日あたり平均」。
 */
export function DowHourView({
  hourly,
  shops,
  shopId,
  yearMonth,
  companyName,
}: {
  hourly: HourlySummary[];
  shops: Shop[];
  shopId?: string;
  yearMonth: string;
  companyName: string;
}) {
  const router = useRouter();
  const [metric, setMetric] = useState<Metric>('sales');

  function go(next: { shop?: string; month?: string }) {
    const params = new URLSearchParams();
    const shopValue = next.shop ?? shopId;
    if (shopValue) params.set('shop', shopValue);
    params.set('month', next.month ?? yearMonth);
    router.push(`/bi/dow-hour?${params.toString()}`);
  }

  const { grid, max, hours } = useMemo(() => {
    // 曜日 × 時間 に積む。日数も数えて平均にする
    const acc = new Map<string, { sales: number; guests: number; days: Set<string> }>();
    const hourSet = new Set<number>();

    for (const row of hourly) {
      // dayjs の day() は 0=日。月曜始まりに直す
      const dow = (dayjs(row.business_date).day() + 6) % 7;
      const key = `${dow}|${row.hour}`;
      hourSet.add(row.hour);

      const current = acc.get(key) ?? { sales: 0, guests: 0, days: new Set<string>() };
      current.sales += row.sales;
      current.guests += row.guest_count;
      current.days.add(row.business_date);
      acc.set(key, current);
    }

    const hours = [...hourSet].sort((a, b) => a - b);
    const grid = new Map<string, number>();
    let max = 0;

    for (const [key, value] of acc) {
      const days = value.days.size || 1;
      const amount =
        metric === 'sales'
          ? value.sales / days
          : metric === 'guests'
            ? value.guests / days
            : value.guests > 0
              ? value.sales / value.guests
              : 0;

      grid.set(key, amount);
      if (amount > max) max = amount;
    }

    return { grid, max, hours };
  }, [hourly, metric]);

  function cellColor(value: number) {
    if (max === 0 || value === 0) return '#fafafa';
    // 薄い青から濃い青へ
    const ratio = value / max;
    return `rgba(22, 119, 255, ${0.08 + ratio * 0.72})`;
  }

  function format(value: number) {
    if (value === 0) return '';
    if (metric === 'guests') return value.toFixed(1);
    return `¥${yen.format(Math.round(value))}`;
  }

  return (
    <>
      <PageHeader
        title="曜日・時間帯別"
        description="どの曜日のどの時間に売れているかを見ます"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '曜日・時間帯別' }]}
      />

      <Card>
        <Flex gap={8} wrap style={{ marginBottom: 16 }}>
          <Select
            placeholder="全店舗"
            allowClear
            value={shopId}
            style={{ width: 220 }}
            onChange={(value) => go({ shop: value ?? '' })}
            options={shops.map((s) => ({ value: s.id, label: s.name }))}
          />
          <DatePicker
            picker="month"
            value={dayjs(yearMonth)}
            allowClear={false}
            onChange={(value) => go({ month: value.format('YYYY-MM') })}
          />
          <Radio.Group
            value={metric}
            optionType="button"
            onChange={(e) => setMetric(e.target.value as Metric)}
            options={[
              { value: 'sales', label: '平均売上' },
              { value: 'guests', label: '平均客数' },
              { value: 'average', label: '客単価' },
            ]}
          />
        </Flex>

        {hours.length === 0 ? (
          <Typography.Text type="secondary">この月の売上はありません。</Typography.Text>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: 8, textAlign: 'left', color: '#8c8c8c' }}>時間</th>
                  {WEEKDAYS.map((label) => (
                    <th key={label} style={{ padding: 8, minWidth: 90, color: '#8c8c8c' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour) => (
                  <tr key={hour}>
                    <td style={{ padding: 8, color: '#8c8c8c' }}>
                      {String(hour).padStart(2, '0')}:00
                    </td>
                    {WEEKDAYS.map((label, dow) => {
                      const value = grid.get(`${dow}|${hour}`) ?? 0;
                      return (
                        <td
                          key={label}
                          className="tabular"
                          style={{
                            padding: 8,
                            textAlign: 'right',
                            background: cellColor(value),
                            border: '1px solid #fff',
                          }}
                        >
                          {format(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
