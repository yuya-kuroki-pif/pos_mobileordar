'use client';

import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { useRouter, useSearchParams } from 'next/navigation';

const yen = new Intl.NumberFormat('ja-JP');
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export interface CalendarDay {
  date: string;
  sales: number;
  target: number;
  guests: number;
  groups: number;
}

/** 達成率の色。未達は赤、達成は緑。目標が無い日は色を付けない */
function rateColor(sales: number, target: number): string | undefined {
  if (target <= 0) return undefined;
  return sales >= target ? '#389e0d' : '#cf1322';
}

/** 営業カレンダー（仕様書 §6.1） */
export function SalesCalendar({
  yearMonth,
  shopName,
  days,
}: {
  yearMonth: string;
  shopName: string;
  days: CalendarDay[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const move = (diff: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('month', dayjs(`${yearMonth}-01`).add(diff, 'month').format('YYYY-MM'));
    router.push(`/bi/salesCalendar?${next.toString()}`);
  };

  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = dayjs(`${yearMonth}-01`);
  // 月初の曜日ぶんだけ空セルを置いて、曜日の列を揃える
  const blanks = first.day();
  const cells: (CalendarDay | null)[] = [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: first.daysInMonth() }, (_, i) => {
      const date = first.add(i, 'day').format('YYYY-MM-DD');
      return byDate.get(date) ?? { date, sales: 0, target: 0, guests: 0, groups: 0 };
    }),
  ];

  const total = days.reduce(
    (sum, day) => ({
      sales: sum.sales + day.sales,
      target: sum.target + day.target,
      guests: sum.guests + day.guests,
    }),
    { sales: 0, target: 0, guests: 0 }
  );

  return (
    <Card
      title={
        <Space>
          <Button size="small" icon={<LeftOutlined />} onClick={() => move(-1)} />
          <Typography.Text strong>{yearMonth.replace('-', '年')}月</Typography.Text>
          <Button size="small" icon={<RightOutlined />} onClick={() => move(1)} />
          <Typography.Text type="secondary">{shopName}</Typography.Text>
        </Space>
      }
      extra={
        <Space size="large">
          <Typography.Text>
            売上 <strong>¥{yen.format(total.sales)}</strong>
          </Typography.Text>
          <Typography.Text type="secondary">
            目標 ¥{yen.format(total.target)}
          </Typography.Text>
          <Typography.Text>
            客数 <strong>{yen.format(total.guests)}</strong>
          </Typography.Text>
        </Space>
      }
    >
      <Flex wrap style={{ borderTop: '1px solid #f0f0f0', borderLeft: '1px solid #f0f0f0' }}>
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            style={{
              width: `${100 / 7}%`,
              padding: '6px 8px',
              borderRight: '1px solid #f0f0f0',
              borderBottom: '1px solid #f0f0f0',
              background: '#fafafa',
              fontSize: 12,
              textAlign: 'center',
              // 土曜は青、日曜は赤（§6.1）
              color: index === 0 ? '#cf1322' : index === 6 ? '#1677ff' : undefined,
            }}
          >
            {label}
          </div>
        ))}

        {cells.map((cell, index) => {
          const weekday = index % 7;
          return (
            <div
              key={cell?.date ?? `blank-${index}`}
              style={{
                width: `${100 / 7}%`,
                minHeight: 96,
                padding: '6px 8px',
                borderRight: '1px solid #f0f0f0',
                borderBottom: '1px solid #f0f0f0',
                background: cell ? undefined : '#fafafa',
              }}
            >
              {cell && (
                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                  <Typography.Text
                    style={{
                      fontSize: 12,
                      color: weekday === 0 ? '#cf1322' : weekday === 6 ? '#1677ff' : undefined,
                    }}
                  >
                    {Number(cell.date.slice(8))}
                  </Typography.Text>
                  {cell.sales > 0 ? (
                    <>
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        ¥{yen.format(cell.sales)}
                      </Typography.Text>
                      {cell.target > 0 && (
                        <Typography.Text
                          style={{ fontSize: 11, color: rateColor(cell.sales, cell.target) }}
                        >
                          {Math.round((cell.sales / cell.target) * 100)}%
                        </Typography.Text>
                      )}
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {cell.guests} 名 / ¥
                        {yen.format(cell.guests === 0 ? 0 : Math.round(cell.sales / cell.guests))}
                      </Typography.Text>
                    </>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      —
                    </Typography.Text>
                  )}
                </Space>
              )}
            </div>
          );
        })}
      </Flex>
    </Card>
  );
}
