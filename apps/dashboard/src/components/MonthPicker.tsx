'use client';

import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * 月セレクタ。いまの URL の `?month=` を差し替えるだけ。
 * 他の絞り込み（店舗など）は消さない。
 */
export function MonthPicker({
  yearMonth,
  basePath,
  param = 'month',
}: {
  yearMonth: string;
  /** 省略時はいまのパスにとどまる */
  basePath?: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <DatePicker
      picker="month"
      value={dayjs(`${yearMonth}-01`)}
      allowClear={false}
      style={{ width: 140 }}
      onChange={(value) => {
        if (!value) return;
        const next = new URLSearchParams(searchParams.toString());
        next.set(param, value.format('YYYY-MM'));
        router.push(`${basePath ?? pathname}?${next.toString()}`);
      }}
    />
  );
}
