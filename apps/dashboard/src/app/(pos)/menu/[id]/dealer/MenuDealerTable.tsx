'use client';

import { App, Card, InputNumber, Space, Switch, Table, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { updateShopMenuAction } from '@/lib/actions/menu';
import type { ShopMenu } from '@/lib/types';

type DealerRow = ShopMenu & { shop_name: string };

/**
 * 取扱設定タブ（仕様書 §5.3 / 画像 03_menu_edit_dealer.jpg）。
 * Switch は切り替えるたびにその行だけ即時保存する（§5.13 の挙動に合わせる）。
 */
export function MenuDealerTable({
  menuId,
  dealers,
  editable,
}: {
  menuId: string;
  dealers: DealerRow[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState<DealerRow[]>(dealers);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function patch(shopId: string, change: Partial<ShopMenu>) {
    // 先に画面へ反映し、失敗したら戻す
    const before = rows;
    setRows((current) =>
      current.map((row) => (row.shop_id === shopId ? { ...row, ...change } : row))
    );
    setSavingShopId(shopId);

    startTransition(async () => {
      const result = await updateShopMenuAction(shopId, menuId, change);
      setSavingShopId(null);
      if (!result.ok) {
        setRows(before);
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, padding: '12px 16px', margin: 0 }}>
        店舗ごとに、このメニューを扱うか・誰に見せるか・在庫があるかを決めます。
        切り替えるとその場で保存されます。
      </Typography.Paragraph>

      <Table<DealerRow>
        rowKey="shop_id"
        dataSource={rows}
        size="middle"
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '店舗名', dataIndex: 'shop_name', width: 220, fixed: 'left' },
          {
            title: '取扱',
            dataIndex: 'is_dealing',
            width: 90,
            render: (value: boolean, row) => (
              <Switch
                checked={value}
                disabled={!editable}
                loading={savingShopId === row.shop_id}
                onChange={(checked) => patch(row.shop_id, { is_dealing: checked })}
              />
            ),
          },
          {
            title: '公開設定（お客様）',
            dataIndex: 'is_visible_customer',
            width: 160,
            render: (value: boolean, row) => (
              <Switch
                checked={value}
                disabled={!editable || !row.is_dealing}
                onChange={(checked) => patch(row.shop_id, { is_visible_customer: checked })}
              />
            ),
          },
          {
            title: '公開設定（スタッフ）',
            dataIndex: 'is_visible_staff',
            width: 170,
            render: (value: boolean, row) => (
              <Switch
                checked={value}
                disabled={!editable || !row.is_dealing}
                onChange={(checked) => patch(row.shop_id, { is_visible_staff: checked })}
              />
            ),
          },
          {
            title: '在庫',
            dataIndex: 'in_stock',
            width: 90,
            render: (value: boolean, row) => (
              <Switch
                checked={value}
                disabled={!editable || !row.is_dealing}
                onChange={(checked) => patch(row.shop_id, { in_stock: checked })}
              />
            ),
          },
          {
            title: '在庫数',
            dataIndex: 'stock_qty',
            width: 140,
            render: (value: number | null, row) => (
              <InputNumber
                size="small"
                min={0}
                value={value ?? undefined}
                placeholder="無制限"
                disabled={!editable || !row.is_dealing}
                style={{ width: 110 }}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const next = raw === '' ? null : Math.max(0, Number(raw) || 0);
                  if (next !== value) patch(row.shop_id, { stock_qty: next });
                }}
              />
            ),
          },
          {
            title: '日次在庫数',
            dataIndex: 'daily_stock_qty',
            width: 150,
            render: (value: number | null, row) => (
              <InputNumber
                size="small"
                min={0}
                value={value ?? undefined}
                placeholder="未設定"
                disabled={!editable || !row.is_dealing}
                style={{ width: 110 }}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const next = raw === '' ? null : Math.max(0, Number(raw) || 0);
                  if (next !== value) patch(row.shop_id, { daily_stock_qty: next });
                }}
              />
            ),
          },
          {
            title: '出力先',
            key: 'printer',
            width: 220,
            render: (_, row) => (
              // 出力先は店舗ごとの実体なので、割り当ては取扱メニュー一覧（§5.13）で行う
              <Space size={4}>
                {row.kitchen_printer_id || row.dish_up_slip_group_id ? (
                  <Tag color="blue">設定あり</Tag>
                ) : (
                  <Tag>未設定</Tag>
                )}
                <Link href={`/shop/menu?shop=${row.shop_id}`}>店舗ごとに設定 ↗</Link>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}
