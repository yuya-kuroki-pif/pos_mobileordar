'use client';

import { Alert, App, Card, Switch, Table } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { setShopQuestionnaireAction } from '@/lib/actions/crm';
import type { Shop, ShopQuestionnaireSetting } from '@/lib/types';

/** モバイルオーダーアンケート設定（仕様書 §5.31）。Switch は即時保存 */
export function QuestionnaireSettingView({
  shops,
  settings,
  companyName,
  editable,
}: {
  shops: Shop[];
  settings: ShopQuestionnaireSetting[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState(settings);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function patch(shopId: string, change: Partial<ShopQuestionnaireSetting>) {
    const before = rows;
    setRows((current) =>
      current.map((row) => (row.shop_id === shopId ? { ...row, ...change } : row))
    );
    setSavingShopId(shopId);

    startTransition(async () => {
      const result = await setShopQuestionnaireAction(shopId, change);
      setSavingShopId(null);
      if (!result.ok) {
        setRows(before);
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      router.refresh();
    });
  }

  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader
        title="アンケート設定"
        description="お会計のあとに、メニューとスタッフの評価をお願いするかどうか"
        breadcrumb={[{ label: companyName }, { label: 'CRM' }, { label: 'アンケート設定' }]}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="集めた回答はアンケート分析で見られます"
        description="メニュー評価は商品ごとの点数とコメント、スタッフ評価は Good / Bad として集まります。"
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ShopQuestionnaireSetting>
          rowKey="shop_id"
          dataSource={rows}
          size="middle"
          pagination={false}
          columns={[
            {
              title: '店舗名',
              dataIndex: 'shop_id',
              render: (value: string) => shopName.get(value) ?? value,
            },
            {
              title: 'メニューアンケート',
              dataIndex: 'menu_review_enabled',
              width: 180,
              render: (value: boolean, row) => (
                <Switch
                  checked={value}
                  disabled={!editable}
                  loading={savingShopId === row.shop_id}
                  onChange={(checked) => patch(row.shop_id, { menu_review_enabled: checked })}
                />
              ),
            },
            {
              title: 'スタッフアンケート',
              dataIndex: 'staff_review_enabled',
              width: 180,
              render: (value: boolean, row) => (
                <Switch
                  checked={value}
                  disabled={!editable}
                  onChange={(checked) => patch(row.shop_id, { staff_review_enabled: checked })}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
