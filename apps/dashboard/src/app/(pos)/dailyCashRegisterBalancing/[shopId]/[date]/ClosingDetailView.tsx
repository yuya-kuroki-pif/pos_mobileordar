'use client';

import { Card, Col, Descriptions, Row, Statistic, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';

import { PageHeader } from '@/components/PageHeader';
import type { ClosingDetail } from '@/lib/transactionQueries';
import { DENOMINATIONS, type BankDepositCorrection } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');
const money = (value: number) => `¥${yen.format(value)}`;

/** 日次処理詳細（仕様書 §5.22） */
export function ClosingDetailView({
  detail,
  shopName,
  companyName,
}: {
  detail: ClosingDetail;
  shopName: string;
  companyName: string;
}) {
  const { closing, byMethod, corrections } = detail;
  const average =
    closing.guest_count > 0 ? Math.round(closing.total_sales / closing.guest_count) : 0;

  return (
    <>
      <PageHeader
        title={`${shopName} ${dayjs(closing.business_day).format('YYYY/MM/DD')} の精算`}
        backTo="/dailyCashRegisterBalancing"
        breadcrumb={[
          { label: companyName },
          { label: '本部機能' },
          { label: '日次処理一覧', href: '/dailyCashRegisterBalancing' },
          { label: dayjs(closing.business_day).format('MM/DD') },
        ]}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="総売上" value={closing.total_sales} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="客数" value={closing.guest_count} suffix="人" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="組数" value={closing.group_count} suffix="組" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="客単価" value={average} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="売上の内訳" style={{ marginBottom: 16 }} styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="name"
              dataSource={[
                ...byMethod,
                { name: '合計', amount: byMethod.reduce((s, m) => s + m.amount, 0) },
              ]}
              size="small"
              pagination={false}
              columns={[
                { title: '支払方法', dataIndex: 'name' },
                {
                  title: '金額',
                  dataIndex: 'amount',
                  align: 'right',
                  render: (value: number, row) => (
                    <span
                      className="tabular"
                      style={{ fontWeight: row.name === '合計' ? 600 : 400 }}
                    >
                      {money(value)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>

          <Card title="現金管理" styles={{ body: { padding: 0 } }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="釣銭準備金">{money(closing.opening_float)}</Descriptions.Item>
              <Descriptions.Item label="現金売上">{money(closing.cash_sales)}</Descriptions.Item>
              <Descriptions.Item label="入金額計">{money(closing.cash_in)}</Descriptions.Item>
              <Descriptions.Item label="出金額計">{money(closing.cash_out)}</Descriptions.Item>
              <Descriptions.Item label="現金在高">{money(closing.expected_cash)}</Descriptions.Item>
              <Descriptions.Item label="実現金在高">{money(closing.counted_cash)}</Descriptions.Item>
              <Descriptions.Item label="現金過不足">
                {closing.difference === 0 ? (
                  <Tag>0</Tag>
                ) : (
                  <Tag color={closing.difference > 0 ? 'blue' : 'red'}>
                    {closing.difference > 0 ? '+' : ''}
                    {yen.format(closing.difference)}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="銀行預入金">{money(closing.bank_deposit)}</Descriptions.Item>
              <Descriptions.Item label="繰越準備金">{money(closing.carryover_fund)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="現金在高（金種別）"
            style={{ marginBottom: 16 }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              rowKey="denomination"
              dataSource={DENOMINATIONS.map((d) => ({
                denomination: d,
                count: closing.denomination_counts[String(d)] ?? 0,
              }))}
              size="small"
              pagination={false}
              columns={[
                {
                  title: '金種',
                  dataIndex: 'denomination',
                  render: (value: number) => `${yen.format(value)} 円`,
                },
                {
                  title: '枚数',
                  dataIndex: 'count',
                  align: 'right',
                  render: (value: number) => <span className="tabular">{value}</span>,
                },
                {
                  title: '金額',
                  key: 'amount',
                  align: 'right',
                  render: (_, row) => (
                    <span className="tabular">{money(row.denomination * row.count)}</span>
                  ),
                },
              ]}
            />
          </Card>

          <Card title="銀行預入金の修正履歴" styles={{ body: { padding: 0 } }}>
            <Table<BankDepositCorrection>
              rowKey="id"
              dataSource={corrections}
              size="small"
              pagination={false}
              locale={{ emptyText: '修正はありません' }}
              columns={[
                {
                  title: '修正日時',
                  dataIndex: 'corrected_at',
                  render: (value: string) => dayjs(value).format('MM/DD HH:mm'),
                },
                { title: '理由', dataIndex: 'reason' },
                {
                  title: '修正前',
                  dataIndex: 'before_amount',
                  align: 'right',
                  render: (value: number) => <span className="tabular">{money(value)}</span>,
                },
                {
                  title: '修正後',
                  dataIndex: 'after_amount',
                  align: 'right',
                  render: (value: number) => <span className="tabular">{money(value)}</span>,
                },
              ]}
            />
            <Typography.Paragraph
              type="secondary"
              style={{ fontSize: 12, padding: '12px 16px', margin: 0 }}
            >
              銀行預入金の修正はレジ端末から行い、その記録がここに残ります。
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>
    </>
  );
}
