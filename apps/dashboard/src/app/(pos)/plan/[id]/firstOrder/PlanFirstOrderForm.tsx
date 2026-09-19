'use client';

import { Alert, App, Button, Card, Select, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setPlanFirstOrderMenusAction } from '@/lib/actions/plan';
import type { MenuRow } from '@/lib/types';

/**
 * 自動注文設定タブ（仕様書 §5.4）。
 * プランを注文した時点で、ここのメニューが自動で注文される
 * （お通し・乾杯ドリンクなど）。
 */
export function PlanFirstOrderForm({
  planId,
  menus,
  selectedIds,
  editable,
}: {
  planId: string;
  menus: MenuRow[];
  selectedIds: string[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [value, setValue] = useState<string[]>(selectedIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setPlanFirstOrderMenusAction(planId, value);
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
        message="プラン注文と同時に自動で通すメニュー"
        description="お通しや乾杯ドリンクのように、プランを頼んだ時点で必ず出すものを指定します。キッチンへの印刷も同時に走ります。"
      />

      <Card title="自動注文するメニュー">
        <Select
          mode="multiple"
          allowClear
          disabled={!editable}
          style={{ width: '100%' }}
          placeholder="メニューを選択（未設定なら自動注文なし）"
          value={value}
          optionFilterProp="label"
          onChange={setValue}
          options={menus.map((menu) => ({
            value: menu.id,
            label: `${menu.name}（¥${menu.price.toLocaleString()}）`,
          }))}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {value.length} 品
        </Typography.Text>
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
          <Button onClick={() => router.push('/plan')}>キャンセル</Button>
          <Button type="primary" onClick={save} loading={pending} disabled={!editable}>
            更 新
          </Button>
        </Space>
      </div>
    </div>
  );
}
