'use client';

import { Alert, App, Card, Select, Space, Switch, Table, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { saveCouponPresetAction } from '@/lib/actions/crm';
import type { Coupon, CouponPreset } from '@/lib/types';

const SEGMENTS: { key: string; label: string; description: string }[] = [
  { key: 'new', label: '新規顧客', description: '初回来店から 7 日後に配ります' },
  { key: 'repeat2', label: 'リピーター', description: '2 回目の来店の翌日に配ります' },
  { key: 'dormant', label: '休眠顧客', description: '1〜2 回来店して 60 日経った方に配ります' },
  { key: 'vip', label: 'VIP顧客', description: '10 回目の来店の 3 日後に配ります' },
];

/** クーポン自動配信（仕様書 §5.31） */
export function CouponPresetView({
  presets,
  coupons,
  companyName,
  editable,
}: {
  presets: CouponPreset[];
  coupons: Coupon[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState(presets);
  const [, startTransition] = useTransition();

  function patch(segment: string, enabled: boolean, couponId: string | null) {
    const before = rows;
    setRows((current) => {
      const found = current.find((r) => r.segment === segment);
      if (found) {
        return current.map((r) =>
          r === found ? { ...r, enabled, coupon_id: couponId } : r
        );
      }
      return [
        ...current,
        { id: segment, company_id: '', segment, enabled, coupon_id: couponId },
      ];
    });

    startTransition(async () => {
      const result = await saveCouponPresetAction(segment, enabled, couponId);
      if (!result.ok) {
        setRows(before);
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="クーポン自動配信"
        description="お客様の状況に合わせて、クーポンを自動で配ります"
        breadcrumb={[{ label: companyName }, { label: 'CRM' }, { label: 'クーポン自動配信' }]}
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="使う前に確かめてください"
        description={
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>LINE の友だちになっているお客様にだけ届きます。</li>
            <li>同じお客様に同じ条件で何度も配ることはありません。</li>
            <li>配信は 1 日 1 回、まとめて行われます。</li>
            <li>クーポンの内容は景品表示法に沿っているか確認してください。</li>
            <li>LINE への送信そのものはまだ動いていません（設定の保存のみ）。</li>
          </ul>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="key"
          dataSource={SEGMENTS}
          size="middle"
          pagination={false}
          columns={[
            {
              title: 'セグメント',
              dataIndex: 'label',
              width: 180,
              render: (value: string, row) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>{value}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {row.description}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: '配信する',
              key: 'enabled',
              width: 120,
              render: (_, row) => {
                const preset = rows.find((r) => r.segment === row.key);
                return (
                  <Switch
                    checked={preset?.enabled ?? false}
                    disabled={!editable}
                    onChange={(checked) => patch(row.key, checked, preset?.coupon_id ?? null)}
                  />
                );
              },
            },
            {
              title: '配るクーポン',
              key: 'coupon',
              width: 280,
              render: (_, row) => {
                const preset = rows.find((r) => r.segment === row.key);
                return (
                  <Select
                    allowClear
                    size="small"
                    placeholder="未設定"
                    value={preset?.coupon_id ?? undefined}
                    disabled={!editable}
                    style={{ width: 240 }}
                    onChange={(value) => patch(row.key, preset?.enabled ?? false, value ?? null)}
                    options={coupons.map((c) => ({ value: c.id, label: c.name }))}
                  />
                );
              },
            },
          ]}
        />
      </Card>
    </>
  );
}
