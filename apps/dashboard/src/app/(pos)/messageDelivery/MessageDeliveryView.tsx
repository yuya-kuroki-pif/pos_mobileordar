'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert, App, Button, Card, Col, Popconfirm, Row, Space, Statistic, Table, Tabs, Tag, Typography,
} from 'antd';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import {
  deleteDeliveryAction,
  setDeliveryStatusAction,
} from '@/lib/actions/messageDelivery';
import {
  CHANNEL_LABELS,
  DELIVERY_STATUS_LABELS,
  type DeliveryStatus,
  type MessagingAccount,
  type MessagingChannel,
  type MessageDelivery,
} from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/** 配信対象の条件を、人が読める 1 行にする */
function describeFilter(delivery: MessageDelivery): string {
  if (delivery.target_type === 'all') return 'すべてのお客様';
  if (delivery.target_type === 'line_ids') return 'LINE ID を指定';

  const filter = delivery.filter as Record<string, number | undefined>;
  const parts: string[] = [];

  if (filter.visitCountFrom) parts.push(`来店 ${filter.visitCountFrom} 回以上`);
  if (filter.visitCountTo) parts.push(`来店 ${filter.visitCountTo} 回以下`);
  if (filter.daysSinceVisitFrom) parts.push(`前回から ${filter.daysSinceVisitFrom} 日以上`);
  if (filter.daysSinceVisitTo) parts.push(`前回から ${filter.daysSinceVisitTo} 日以内`);

  return parts.length > 0 ? parts.join(' / ') : '条件なし';
}

/** メッセージ配信（仕様書 §5.29） */
export function MessageDeliveryView({
  deliveries,
  accounts,
  companyName,
  editable,
}: {
  deliveries: MessageDelivery[];
  accounts: MessagingAccount[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();

  function changeStatus(id: string, status: DeliveryStatus) {
    startTransition(async () => {
      const result = await setDeliveryStatusAction(id, status);
      if (!result.ok) {
        message.error(result.error ?? '状態を変えられませんでした');
        return;
      }
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteDeliveryAction(id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  function table(rows: MessageDelivery[]) {
    return (
      <Card styles={{ body: { padding: 0 } }}>
        <Table<MessageDelivery>
          rowKey="id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          locale={{ emptyText: '配信はありません' }}
          columns={[
            {
              title: 'チャネル',
              dataIndex: 'channel',
              width: 110,
              fixed: 'left',
              render: (value: MessagingChannel) => (
                <Tag color={value === 'zalo' ? 'cyan' : 'green'}>{CHANNEL_LABELS[value]}</Tag>
              ),
            },
            {
              title: '配信管理名',
              dataIndex: 'name',
              width: 280,
              fixed: 'left',
              render: (value: string, row) => (
                <Link href={`/messageDelivery/${row.id}/edit`}>{value}</Link>
              ),
            },
            {
              title: '配信対象',
              key: 'target',
              width: 300,
              render: (_, row) => describeFilter(row),
            },
            {
              title: '対象者数',
              dataIndex: 'target_count',
              width: 120,
              align: 'right',
              render: (value: number) => <span className="tabular">{yen.format(value)}</span>,
            },
            {
              title: '配信数上限',
              dataIndex: 'max_count',
              width: 120,
              align: 'right',
              render: (value: number | null) =>
                value ? (
                  <span className="tabular">{yen.format(value)}</span>
                ) : (
                  <span style={{ color: '#bfbfbf' }}>なし</span>
                ),
            },
            {
              title: '対象者数の更新',
              dataIndex: 'target_updated_at',
              width: 170,
              render: (value: string | null) =>
                value ? dayjs(value).format('YYYY/MM/DD HH:mm') : <span style={{ color: '#bfbfbf' }}>—</span>,
            },
            {
              title: '配信日時',
              dataIndex: 'scheduled_at',
              width: 170,
              render: (value: string | null) =>
                value ? dayjs(value).format('YYYY/MM/DD HH:mm') : <span style={{ color: '#bfbfbf' }}>未定</span>,
            },
            {
              title: '毎日配信',
              dataIndex: 'repeat_daily',
              width: 110,
              render: (value: boolean) => (value ? <Tag color="blue">有効</Tag> : <Tag>—</Tag>),
            },
            {
              title: '操作',
              key: 'actions',
              width: 200,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  {row.status === 'suspended' ? (
                    <Button
                      size="small"
                      disabled={!editable || pending}
                      onClick={() => changeStatus(row.id, 'reserved')}
                    >
                      再開
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      disabled={!editable || pending || row.status === 'sent'}
                      onClick={() => changeStatus(row.id, 'suspended')}
                    >
                      停止
                    </Button>
                  )}
                  <Popconfirm
                    title="この配信を削除しますか？"
                    onConfirm={() => remove(row.id)}
                    okText="削除"
                    cancelText="やめる"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={!editable} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    );
  }

  const byStatus = (status: DeliveryStatus) => deliveries.filter((d) => d.status === status);

  return (
    <>
      <PageHeader
        title="メッセージ配信"
        description="LINE の友だちへ、条件を絞ってメッセージを送ります"
        breadcrumb={[{ label: companyName }, { label: 'CRM' }, { label: 'メッセージ配信' }]}
        extra={
          <Link href="/messageDelivery/new/edit">
            <Button type="primary" icon={<PlusOutlined />} disabled={!editable}>
              新規作成
            </Button>
          </Link>
        }
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="LINE / Zalo への送信は未実装です"
        description="配信の予約・条件・本文は作って保存できますが、実際にメッセージを送る仕組み（LINE Messaging API・Zalo OA API との接続）はまだ動いていません。予約した配信は送られないまま残ります。"
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {accounts.map((item) => (
          <Col key={item.id} xs={12} md={6}>
            <Card>
              <Statistic
                title={`${CHANNEL_LABELS[item.channel]} 今月の送信可能数`}
                value={item.monthly_quota}
                suffix="通"
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                有効 {item.friends_active} 人
                {item.channel === 'zalo' && ` / ZNS 上限 ${item.zns_quota} 通`}
              </Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs
        items={(['reserved', 'draft', 'suspended', 'sent'] as DeliveryStatus[]).map((status) => ({
          key: status,
          label: `${DELIVERY_STATUS_LABELS[status]}（${byStatus(status).length}）`,
          children: table(byStatus(status)),
        }))}
      />
    </>
  );
}
