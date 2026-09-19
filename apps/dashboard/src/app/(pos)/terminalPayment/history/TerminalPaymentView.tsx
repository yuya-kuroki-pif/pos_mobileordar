'use client';

import { DownloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Row, Select, Space, Statistic, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import type { Shop, TerminalPayment } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/** キャッシュレス決済履歴（仕様書 §5.24） */
export function TerminalPaymentView({
  payments,
  shops,
  shopId,
  companyName,
}: {
  payments: TerminalPayment[];
  shops: Shop[];
  shopId?: string;
  companyName: string;
}) {
  const router = useRouter();

  const sales = payments.reduce((sum, p) => sum + p.amount, 0);
  const fee = payments.reduce((sum, p) => sum + p.fee, 0);

  function downloadCsv() {
    const header = [
      '取引日時',
      '区分',
      '取引ID',
      '決済種別',
      '決済状態',
      '売上',
      '手数料',
      '手数料差引後',
      'ブランド',
      '発行国',
      'カード番号',
    ];
    const body = payments.map((p) =>
      [
        dayjs(p.occurred_at).format('YYYY/MM/DD HH:mm'),
        p.kind ?? '',
        p.transaction_id,
        p.method ?? '',
        p.status,
        p.amount,
        p.fee,
        p.net,
        p.brand ?? '',
        p.issuer_country ?? '',
        p.masked_pan ?? '',
      ].join(',')
    );

    const blob = new Blob(['\ufeff' + [header.join(','), ...body].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'terminal-payments.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="キャッシュレス決済履歴"
        description="決済端末を通った取引と、その手数料"
        breadcrumb={[{ label: companyName }, { label: '本部機能' }, { label: 'キャッシュレス決済履歴' }]}
        extra={
          <Space>
            {shops.length > 0 && (
              <Select
                value={shopId}
                style={{ width: 220 }}
                onChange={(value) => router.push(`/terminalPayment/history?shop=${value}`)}
                options={shops.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
            <Button
              icon={<DownloadOutlined />}
              disabled={payments.length === 0}
              onClick={downloadCsv}
            >
              CSV
            </Button>
          </Space>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={8}>
          <Card>
            <Statistic title="売上純額" value={sales - fee} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card>
            <Statistic title="売上" value={sales} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card>
            <Statistic title="決済手数料" value={fee} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="入金サイクルと手数料プランは決済会社との契約で決まります"
        description="この画面は端末から取り込んだ取引を並べています。返金申請は決済会社の管理画面から行ってください。"
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<TerminalPayment>
          rowKey="id"
          dataSource={payments}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} 件` }}
          columns={[
            {
              title: '取引日時',
              dataIndex: 'occurred_at',
              width: 170,
              fixed: 'left',
              render: (value: string) => dayjs(value).format('YYYY/MM/DD HH:mm'),
            },
            { title: '区分', dataIndex: 'kind', width: 90 },
            { title: '取引ID', dataIndex: 'transaction_id', width: 140 },
            { title: '決済種別', dataIndex: 'method', width: 160 },
            {
              title: '決済状態',
              dataIndex: 'status',
              width: 110,
              render: (value: string) => (
                <Tag color={value === 'captured' ? 'green' : undefined}>
                  {value === 'captured' ? '売上確定' : value}
                </Tag>
              ),
            },
            {
              title: '売上',
              dataIndex: 'amount',
              width: 120,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '手数料',
              dataIndex: 'fee',
              width: 110,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '手数料差引後',
              dataIndex: 'net',
              width: 140,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            { title: 'ブランド', dataIndex: 'brand', width: 120 },
            { title: '発行国', dataIndex: 'issuer_country', width: 90 },
            { title: 'カード番号', dataIndex: 'masked_pan', width: 180 },
          ]}
        />
      </Card>
    </>
  );
}
