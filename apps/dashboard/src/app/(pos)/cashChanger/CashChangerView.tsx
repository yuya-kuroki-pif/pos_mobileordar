'use client';

import { Alert, App, Card, Switch, Table, Tabs, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { saveCashChangerAction } from '@/lib/actions/companySettings';
import type { CashChangerSetting, Shop } from '@/lib/types';

type Field = keyof Omit<CashChangerSetting, 'shop_id'>;

const TABS: { key: Field; label: string; column: string; description: string }[] = [
  {
    key: 'keep_float_in_changer',
    label: '釣銭準備金の残置設定',
    column: '準備金を自動釣銭機内に残す',
    description: 'レジ締めのあとも準備金を釣銭機に入れたままにします。翌日の開店準備が要らなくなります。',
  },
  {
    key: 'allow_external_deposit',
    label: '釣銭機外入金設定',
    column: '釣銭機を通さない入金を許可する',
    description: '売上金を釣銭機に入れず、金庫などへ直接入れる運用を許可します。',
  },
  {
    key: 'allow_emergency_cash',
    label: '緊急入出金設定',
    column: '緊急入出金を許可する',
    description: '釣銭が足りないときなどに、レジ締めを待たずに入出金できるようにします。',
  },
];

/** 自動釣銭機設定（仕様書 §5.9）。Switch は切り替えるたびに即時保存する */
export function CashChangerView({
  shops,
  settings,
  companyName,
  editable,
}: {
  shops: Shop[];
  settings: CashChangerSetting[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState<CashChangerSetting[]>(settings);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function patch(shopId: string, field: Field, value: boolean) {
    const before = rows;
    setRows((current) =>
      current.map((row) => (row.shop_id === shopId ? { ...row, [field]: value } : row))
    );
    setSavingShopId(shopId);

    startTransition(async () => {
      const result = await saveCashChangerAction(shopId, { [field]: value });
      setSavingShopId(null);
      if (!result.ok) {
        setRows(before);
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      router.refresh();
    });
  }

  const shopName = new Map(shops.map((shop) => [shop.id, shop.name]));

  return (
    <>
      <PageHeader
        title="自動釣銭機設定"
        description="店舗ごとに、自動釣銭機の扱いを決めます"
        breadcrumb={[{ label: companyName }, { label: '業態管理' }, { label: '自動釣銭機設定' }]}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="自動釣銭機を置いている店舗だけが対象です"
        description="釣銭機が無い店舗では、ここの設定は効きません。"
      />

      <Tabs
        items={TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          children: (
            <Card styles={{ body: { padding: 0 } }}>
              <Typography.Paragraph
                type="secondary"
                style={{ fontSize: 12, padding: '12px 16px', margin: 0 }}
              >
                {tab.description}
              </Typography.Paragraph>

              <Table<CashChangerSetting>
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
                    title: tab.column,
                    dataIndex: tab.key,
                    width: 260,
                    render: (value: boolean, row) => (
                      <Switch
                        checked={value}
                        disabled={!editable}
                        loading={savingShopId === row.shop_id}
                        onChange={(checked) => patch(row.shop_id, tab.key, checked)}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          ),
        }))}
      />
    </>
  );
}
