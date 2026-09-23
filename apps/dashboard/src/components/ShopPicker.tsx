'use client';

import { Select } from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** 店舗セレクタ。いまの URL のクエリを差し替えるだけ */
export function ShopPicker({
  shops,
  shopId,
  basePath,
  allowAll = false,
  param = 'shop',
  width = 240,
}: {
  shops: { id: string; name: string }[];
  shopId?: string;
  /** 省略時はいまのパスにとどまる */
  basePath?: string;
  /** 「全店舗」を選べるようにする */
  allowAll?: boolean;
  param?: string;
  width?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (shops.length === 0) return null;

  const options = [
    ...(allowAll ? [{ value: 'all', label: '全店舗' }] : []),
    ...shops.map((shop) => ({ value: shop.id, label: shop.name })),
  ];

  return (
    <Select
      value={shopId ?? (allowAll ? 'all' : undefined)}
      style={{ width }}
      onChange={(value) => {
        // 他の絞り込みを消さないよう、いまのクエリに上書きする
        const next = new URLSearchParams(searchParams.toString());
        next.set(param, value);
        router.push(`${basePath ?? pathname}?${next.toString()}`);
      }}
      options={options}
    />
  );
}
