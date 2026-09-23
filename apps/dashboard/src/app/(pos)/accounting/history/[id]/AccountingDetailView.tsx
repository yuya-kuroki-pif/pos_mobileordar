'use client';

import { Alert, App, Button, Card, Col, Descriptions, Input, InputNumber, Row, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { modifyAccountingAction, voidAccountingAction } from '@/lib/actions/accounting';
import type { AccountingDetail } from '@/lib/transactionQueries';
import type { OrderItemRecord } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');
const money = (value: number) => `¥${yen.format(value)}`;

/** 会計詳細（仕様書 §5.23）。取消は重要操作履歴に残る */
export function AccountingDetailView({
  detail,
  shopName,
  companyName,
  editable,
}: {
  detail: AccountingDetail;
  shopName: string;
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { payment, items, session } = detail;

  // 明細の修正。触った行だけ覚えておき、保存のときにまとめて送る
  const [edits, setEdits] = useState<Record<string, { unit_price: number; quantity: number }>>({});
  const [reason, setReason] = useState('');

  const locked = !editable || Boolean(payment.voided_at);
  const dirty = Object.keys(edits).length > 0;

  const valueOf = (item: OrderItemRecord, key: 'unit_price' | 'quantity') =>
    edits[item.id]?.[key] ?? item[key];

  function edit(item: OrderItemRecord, key: 'unit_price' | 'quantity', value: number) {
    setEdits((prev) => ({
      ...prev,
      [item.id]: {
        unit_price: prev[item.id]?.unit_price ?? item.unit_price,
        quantity: prev[item.id]?.quantity ?? item.quantity,
        [key]: value,
      },
    }));
  }

  function saveEdits() {
    if (!reason.trim()) {
      setError('修正の理由を入力してください。重要操作履歴に残ります。');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await modifyAccountingAction(
        payment.id,
        Object.entries(edits).map(([item_id, value]) => ({ item_id, ...value })),
        reason.trim()
      );
      if (!result.ok) {
        setError(result.error ?? '修正できませんでした');
        return;
      }
      message.success('修正しました');
      setEdits({});
      setReason('');
      router.refresh();
    });
  }

  function confirmVoid() {
    modal.confirm({
      title: 'この会計を取り消しますか？',
      content: '取り消すと売上から外れます。操作は重要操作履歴に残ります。',
      okText: '取り消す',
      okButtonProps: { danger: true },
      cancelText: 'やめる',
      onOk: () =>
        new Promise<void>((resolve) => {
          startTransition(async () => {
            const result = await voidAccountingAction(payment.id, 'ダッシュボードから取消');
            if (!result.ok) setError(result.error ?? '取り消せませんでした');
            else {
              message.success('取り消しました');
              router.refresh();
            }
            resolve();
          });
        }),
    });
  }

  return (
    <>
      <PageHeader
        title={`レシート番号 ${payment.receipt_number ?? '—'}`}
        backTo="/accounting/history"
        breadcrumb={[
          { label: companyName },
          { label: '本部機能' },
          { label: '会計履歴一覧', href: '/accounting/history' },
          { label: String(payment.receipt_number ?? '') },
        ]}
        tags={[shopName]}
      />

      {payment.voided_at && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="この会計は取り消されています"
          description={payment.void_reason ?? undefined}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="取扱情報" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="会計ID">{payment.id}</Descriptions.Item>
              <Descriptions.Item label="会計時刻">
                {dayjs(payment.paid_at).format('YYYY/MM/DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="レシート番号">
                {payment.receipt_number ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="担当スタッフ">{payment.clerk_name ?? '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="顧客情報">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="テーブル">{payment.table_name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="人数">
                {payment.guest_count ?? session?.guest_count ?? '—'} 人
              </Descriptions.Item>
              <Descriptions.Item label="媒体">
                {payment.inflow_source_id ? <Tag>設定あり</Tag> : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="取扱明細" styles={{ body: { padding: 0 } }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="小計">{money(payment.subtotal)}</Descriptions.Item>
              <Descriptions.Item label="割引">
                {payment.discount > 0 ? `- ${money(payment.discount)}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="サービス料">
                {money(payment.service_charge)}
              </Descriptions.Item>
              <Descriptions.Item label="合計">
                <strong>{money(payment.total)}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="内消費税">{money(payment.tax)}</Descriptions.Item>
              <Descriptions.Item label="支払方法">
                <Tag color="blue">{payment.method_name}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title="商品明細" style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
        <Table<OrderItemRecord>
          rowKey="id"
          dataSource={items}
          size="small"
          pagination={false}
          columns={[
            { title: 'メニュー名', dataIndex: 'name_snapshot' },
            {
              title: '支払価格（税込）',
              key: 'unit_price',
              width: 150,
              align: 'right',
              render: (_, item) => (
                <InputNumber
                  value={valueOf(item, 'unit_price')}
                  min={0}
                  step={10}
                  disabled={locked}
                  style={{ width: '100%' }}
                  onChange={(value) => edit(item, 'unit_price', Number(value ?? 0))}
                />
              ),
            },
            {
              title: '個数',
              key: 'quantity',
              width: 110,
              align: 'right',
              render: (_, item) => (
                <InputNumber
                  value={valueOf(item, 'quantity')}
                  min={0}
                  disabled={locked}
                  style={{ width: '100%' }}
                  onChange={(value) => edit(item, 'quantity', Number(value ?? 0))}
                />
              ),
            },
            {
              title: '小計',
              key: 'line_total',
              width: 120,
              align: 'right',
              render: (_, item) => (
                <span className="tabular">
                  {money(valueOf(item, 'unit_price') * valueOf(item, 'quantity'))}
                </span>
              ),
            },
          ]}
        />

        {dirty && (
          <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                type="warning"
                showIcon
                message="明細を変更しています"
                description="保存すると会計の合計と消費税も引き直され、重要操作履歴に残ります。"
              />
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="修正の理由（必須）"
                maxLength={200}
              />
              <Space>
                <Button type="primary" onClick={saveEdits} loading={pending}>
                  修正を保存
                </Button>
                <Button onClick={() => setEdits({})} disabled={pending}>
                  やめる
                </Button>
              </Space>
            </Space>
          </div>
        )}
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />}

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button onClick={() => router.push('/accounting/history')}>一覧へ戻る</Button>
          <Button
            danger
            loading={pending}
            disabled={!editable || Boolean(payment.voided_at)}
            onClick={confirmVoid}
          >
            会計を取り消す
          </Button>
        </Space>
      </div>
    </>
  );
}
