'use client';

import { App, Card, Switch, Table, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { updateShopPlanAction } from '@/lib/actions/plan';
import type { ShopPlan } from '@/lib/types';

type DealerRow = ShopPlan & { shop_name: string };

/**
 * 取扱設定タブ（仕様書 §5.4）。
 * メニューの取扱設定と同じく、切り替えるたびにその行だけ即時保存する。
 */
export function PlanDealerTable({
  planId,
  dealers,
  editable,
}: {
  planId: string;
  dealers: DealerRow[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState<DealerRow[]>(dealers);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function patch(shopId: string, change: Partial<ShopPlan>) {
    // 先に画面へ反映し、失敗したら戻す
    const before = rows;
    setRows((current) =>
      current.map((row) => (row.shop_id === shopId ? { ...row, ...change } : row))
    );
    setSavingShopId(shopId);

    startTransition(async () => {
      const result = await updateShopPlanAction(shopId, planId, change);
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
      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, padding: '12px 16px', margin: 0 }}
      >
        店舗ごとに、このプランを扱うか・誰に見せるかを決めます。切り替えるとその場で保存されます。
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
        ]}
      />
    </Card>
  );
}
