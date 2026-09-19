'use client';

import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Row, Statistic, Table, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';

import { PageHeader } from '@/components/PageHeader';
import {
  DELIVERY_STATUS_LABELS,
  type DeliveryStatus,
  type LineOfficialAccount,
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
}: {
  deliveries: MessageDelivery[];
  accounts: LineOfficialAccount[];
  companyName: string;
}) {
  const account = accounts[0];

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
            { title: '配信管理名', dataIndex: 'name', width: 260, fixed: 'left' },
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
          <Button type="primary" icon={<PlusOutlined />} disabled>
            新規作成
          </Button>
        }
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="LINE への送信は未実装です"
        description="配信の設定は保存できますが、実際にメッセージを送る仕組み（LINE Messaging API との接続）はまだ動いていません。新規作成もその実装と合わせて開けるようにします。"
      />

      {account && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="今月の送信可能数" value={account.monthly_quota} suffix="通" />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="有効友だち数" value={account.friends_active} suffix="人" />
            </Card>
          </Col>
        </Row>
      )}

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
