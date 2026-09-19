'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Empty, Flex, Input, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { TimeMinInput } from '@/components/TimeMinInput';
import { saveBusinessHoursAction } from '@/lib/actions/shop';
import type { BusinessHour, Shop } from '@/lib/types';

/** 保存時にサーバー側で採番するので、新規行の id は画面内の一時キー */
function newRow(shopId: string, order: number): BusinessHour {
  return {
    id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
    shop_id: shopId,
    name: '',
    start_min: 17 * 60,
    end_min: 21 * 60,
    display_order: order,
  };
}

/**
 * 店舗編集 — 営業時間帯タブ（仕様書 §5.12）。
 * ここで作った時間帯は、分析画面の「営業時間帯」絞り込みに使う。
 */
export function BusinessHourEditor({
  shop,
  hours,
  editable,
}: {
  shop: Shop;
  hours: BusinessHour[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState<BusinessHour[]>(hours);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(id: string, change: Partial<BusinessHour>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveBusinessHoursAction(shop.id, rows);
      if (!result.ok) {
        setError(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 16 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="分析画面の絞り込みに使います"
        description="「ディナー 17:00〜21:00」のように区切っておくと、売上を時間帯ごとに見られます。24 時を超える場合は 25:00 のように書きます。"
      />

      <Card title="営業時間帯">
        {rows.length === 0 && <Empty description="営業時間帯がありません" />}

        {rows.map((row) => (
          <Flex key={row.id} gap={8} align="center" wrap style={{ marginBottom: 8 }}>
            <Input
              value={row.name}
              disabled={!editable}
              placeholder="例: ディナー"
              style={{ width: 200 }}
              onChange={(e) => patch(row.id, { name: e.target.value })}
            />
            <div style={{ width: 110 }}>
              <TimeMinInput
                value={row.start_min}
                disabled={!editable}
                onChange={(value) => patch(row.id, { start_min: value ?? 0 })}
              />
            </div>
            <span style={{ color: '#8c8c8c' }}>〜</span>
            <div style={{ width: 110 }}>
              <TimeMinInput
                value={row.end_min}
                disabled={!editable}
                placeholder="21:00"
                onChange={(value) => patch(row.id, { end_min: value ?? 0 })}
              />
            </div>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={!editable}
              onClick={() => setRows((c) => c.filter((x) => x.id !== row.id))}
            />
          </Flex>
        ))}

        <Button
          size="small"
          icon={<PlusOutlined />}
          disabled={!editable}
          style={{ marginTop: 8 }}
          onClick={() => setRows((c) => [...c, newRow(shop.id, (c.length + 1) * 10)])}
        >
          追 加
        </Button>

        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
          {rows.length} 件
        </Typography.Paragraph>
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#f5f5f5',
          padding: '16px 0',
          marginTop: 16,
          textAlign: 'right',
        }}
      >
        <Space>
          <Button onClick={() => router.push('/shop')}>キャンセル</Button>
          <Button type="primary" onClick={save} loading={pending} disabled={!editable}>
            更 新
          </Button>
        </Space>
      </div>
    </div>
  );
}
