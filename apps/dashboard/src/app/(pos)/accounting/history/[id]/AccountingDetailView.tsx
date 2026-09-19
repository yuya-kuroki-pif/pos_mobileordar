'use client';

import { Alert, App, Button, Card, Col, Descriptions, Row, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { voidAccountingAction } from '@/lib/actions/accounting';
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
              title: '単価',
              dataIndex: 'unit_price',
              width: 120,
              align: 'right',
              render: (value: number) => <span className="tabular">{money(value)}</span>,
            },
            {
              title: '個数',
              dataIndex: 'quantity',
              width: 90,
              align: 'right',
              render: (value: number) => <span className="tabular">{value}</span>,
            },
            {
              title: '小計',
              dataIndex: 'line_total',
              width: 120,
              align: 'right',
              render: (value: number) => <span className="tabular">{money(value)}</span>,
            },
          ]}
        />
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
