'use client';

import { Select } from 'antd';
import { useRouter } from 'next/navigation';

import type { Shop } from '@/lib/types';

/** 店舗セレクタ。URL の ?shop= を差し替えるだけ */
export function ShopPicker({
  shops,
  shopId,
  basePath = '/previewUserApp',
}: {
  shops: Shop[];
  shopId?: string;
  basePath?: string;
}) {
  const router = useRouter();

  if (shops.length === 0) return null;

  return (
    <Select
      value={shopId}
      style={{ width: 240 }}
      onChange={(value) => router.push(`${basePath}?shop=${value}`)}
      options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
    />
  );
}
