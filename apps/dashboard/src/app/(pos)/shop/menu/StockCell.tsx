'use client';

import { InputNumber, Space } from 'antd';

import type { ShopMenu, ShopMenuRow } from '@/lib/types';

/**
 * 在庫数・日次在庫数のセル（仕様書 §5.13）。
 * 入力し終えた時点（blur）で、値が変わっていればその行だけ保存する。
 */
export function StockCell({
  row,
  editable,
  onSave,
}: {
  row: ShopMenuRow;
  editable: boolean;
  onSave: (change: Partial<ShopMenu>) => void;
}) {
  function handleBlur(field: 'stock_qty' | 'daily_stock_qty', raw: string) {
    const trimmed = raw.trim();
    const next = trimmed === '' ? null : Math.max(0, Number(trimmed) || 0);
    if (next !== row[field]) onSave({ [field]: next });
  }

  return (
    <Space size={4}>
      <InputNumber
        size="small"
        min={0}
        value={row.stock_qty ?? undefined}
        placeholder="無制限"
        disabled={!editable}
        style={{ width: 100 }}
        onBlur={(e) => handleBlur('stock_qty', e.target.value)}
      />
      <InputNumber
        size="small"
        min={0}
        value={row.daily_stock_qty ?? undefined}
        placeholder="日次未設定"
        disabled={!editable}
        style={{ width: 110 }}
        onBlur={(e) => handleBlur('daily_stock_qty', e.target.value)}
      />
    </Space>
  );
}
