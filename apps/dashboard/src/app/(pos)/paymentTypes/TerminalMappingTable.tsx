'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Empty, Flex, Input, Select, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveTerminalPaymentMethodsAction } from '@/lib/actions/payment';
import type { PaymentMethod, TerminalPaymentMethod } from '@/lib/types';

type Draft = { id: string; brand: string; payment_method_id: string | null };

/**
 * キャッシュレス端末支払方法（仕様書 §5.10 / /adyenTerminalOnSitePaymentDetailType）。
 * 決済端末が返すブランド名を、レジの支払方法へ対応づける。
 */
export function TerminalMappingTable({
  rows,
  methods,
  editable,
}: {
  rows: TerminalPaymentMethod[];
  methods: PaymentMethod[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    rows.map((row) => ({
      id: row.id,
      brand: row.brand,
      payment_method_id: row.payment_method_id,
    }))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(id: string, change: Partial<Draft>) {
    setDrafts((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveTerminalPaymentMethodsAction(drafts);
      if (!result.ok) {
        setError(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      router.refresh();
    });
  }

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="決済端末のブランド名を支払方法に読み替えます"
        description="端末から返ってくる名称（VISA、iD、PayPay など）を、レジで集計したい支払方法へ対応づけます。"
      />

      <Card title="キャッシュレス端末支払方法">
        {drafts.length === 0 && <Empty description="対応づけがありません" />}

        {drafts.map((row) => (
          <Flex key={row.id} gap={8} align="center" wrap style={{ marginBottom: 8 }}>
            <Input
              value={row.brand}
              disabled={!editable}
              placeholder="例: VISA"
              style={{ width: 220 }}
              onChange={(e) => patch(row.id, { brand: e.target.value })}
            />
            <span style={{ color: '#8c8c8c' }}>→</span>
            <Select
              allowClear
              value={row.payment_method_id ?? undefined}
              disabled={!editable}
              placeholder="支払方法（未設定）"
              style={{ width: 240 }}
              onChange={(value) => patch(row.id, { payment_method_id: value ?? null })}
              options={methods.map((m) => ({ value: m.id, label: m.name }))}
            />
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={!editable}
              onClick={() => setDrafts((c) => c.filter((x) => x.id !== row.id))}
            />
          </Flex>
        ))}

        <Button
          size="small"
          icon={<PlusOutlined />}
          disabled={!editable}
          style={{ marginTop: 8 }}
          onClick={() =>
            setDrafts((c) => [
              ...c,
              {
                id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
                brand: '',
                payment_method_id: null,
              },
            ])
          }
        >
          追 加
        </Button>

        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
          {drafts.length} 件
        </Typography.Paragraph>
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />}

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button type="primary" onClick={save} loading={pending} disabled={!editable}>
            更 新
          </Button>
        </Space>
      </div>
    </>
  );
}
