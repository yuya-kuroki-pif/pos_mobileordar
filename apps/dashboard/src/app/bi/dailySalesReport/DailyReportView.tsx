'use client';

import { CopyOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { saveDailyReportAction } from '@/lib/actions/dailyReport';
import type { AuditLogRow } from '@/lib/transactionQueries';
import {
  AUDIT_EVENT_LABELS,
  type AuditEvent,
  type CashClosing,
  type DailySummary,
  type HourlySummary,
  type Shop,
} from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');
const money = (value: number) => `¥${yen.format(value)}`;

/** 日報（仕様書 §6.3）。その日の数字をまとめ、コメントを残す */
export function DailyReportView({
  shops,
  shopId,
  shopName,
  businessDate,
  today,
  monthToDate,
  closing,
  audits,
  hourly,
  comment,
  companyName,
}: {
  shops: Shop[];
  shopId?: string;
  shopName: string;
  businessDate: string;
  today: DailySummary | null;
  monthToDate: DailySummary[];
  closing: CashClosing | null;
  audits: AuditLogRow[];
  hourly: HourlySummary[];
  comment: string;
  companyName: string;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [draft, setDraft] = useState(comment);
  const [pending, startTransition] = useTransition();

  const sales = today?.sales ?? 0;
  const guests = today?.guest_count ?? 0;
  const groups = today?.group_count ?? 0;
  const target = today?.target ?? 0;
  const monthSales = monthToDate.reduce((sum, d) => sum + d.sales, 0);

  function go(next: { shop?: string; date?: string }) {
    const params = new URLSearchParams();
    params.set('shop', next.shop ?? shopId ?? '');
    params.set('date', next.date ?? businessDate);
    router.push(`/bi/dailySalesReport?${params.toString()}`);
  }

  function copyReport() {
    const lines = [
      `【${shopName} ${dayjs(businessDate).format('YYYY/MM/DD')} 日報】`,
      `売上: ${money(sales)}${target > 0 ? `（達成率 ${((sales / target) * 100).toFixed(1)}%）` : ''}`,
      `客数: ${guests} 人 / 組数: ${groups} 組 / 客単価: ${money(guests > 0 ? Math.round(sales / guests) : 0)}`,
      `当月累計: ${money(monthSales)}`,
      closing ? `レジ誤差: ${money(closing.difference)} / 銀行預入金: ${money(closing.bank_deposit)}` : '',
      draft ? `コメント: ${draft}` : '',
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    message.success('日報の内容をコピーしました');
  }

  function save() {
    if (!shopId) return;
    startTransition(async () => {
      const result = await saveDailyReportAction(shopId, businessDate, draft);
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      router.refresh();
    });
  }

  const auditSummary = (Object.keys(AUDIT_EVENT_LABELS) as AuditEvent[])
    .map((event) => {
      const rows = audits.filter((a) => a.event_type === event);
      return {
        event,
        label: AUDIT_EVENT_LABELS[event],
        count: rows.length,
        amount: rows.reduce((sum, r) => sum + (r.amount ?? 0), 0),
      };
    })
    .filter((row) => row.count > 0);

  return (
    <>
      <PageHeader
        title="日報"
        description="その日の数字をひとまとめにします"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '日報' }]}
        extra={
          <Space>
            <Select
              value={shopId}
              style={{ width: 220 }}
              onChange={(value) => go({ shop: value })}
              options={shops.map((s) => ({ value: s.id, label: s.name }))}
            />
            <DatePicker
              value={dayjs(businessDate)}
              allowClear={false}
              onChange={(value) => go({ date: value.format('YYYY-MM-DD') })}
            />
            <Button icon={<CopyOutlined />} onClick={copyReport}>
              日報の内容をコピー
            </Button>
          </Space>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="売上" value={sales} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="達成率"
              value={target > 0 ? (sales / target) * 100 : 0}
              precision={1}
              suffix="%"
              valueStyle={{ color: target > 0 && sales >= target ? '#52c41a' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="客数 / 組数" value={guests} suffix={`人 / ${groups} 組`} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="当月累計" value={monthSales} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="現金・レジ締め" style={{ marginBottom: 16 }}>
            {closing ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="レジ誤差">
                  {closing.difference === 0 ? (
                    <Tag>0</Tag>
                  ) : (
                    <Tag color={closing.difference > 0 ? 'blue' : 'red'}>
                      {closing.difference > 0 ? '+' : ''}
                      {yen.format(closing.difference)}
                    </Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="銀行預入金">
                  {money(closing.bank_deposit)}
                </Descriptions.Item>
                <Descriptions.Item label="現金売上">{money(closing.cash_sales)}</Descriptions.Item>
                <Descriptions.Item label="入金額計">{money(closing.cash_in)}</Descriptions.Item>
                <Descriptions.Item label="出金額計">{money(closing.cash_out)}</Descriptions.Item>
              </Descriptions>
            ) : (
              <span style={{ color: '#8c8c8c' }}>この日の精算はまだありません。</span>
            )}
          </Card>

          <Card title="監査" styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="event"
              dataSource={auditSummary}
              size="small"
              pagination={false}
              locale={{ emptyText: '記録された操作はありません' }}
              columns={[
                { title: '種別', dataIndex: 'label' },
                {
                  title: '件数',
                  dataIndex: 'count',
                  align: 'right',
                  render: (value: number) => <span className="tabular">{value}</span>,
                },
                {
                  title: '金額',
                  dataIndex: 'amount',
                  align: 'right',
                  render: (value: number) => <span className="tabular">{money(value)}</span>,
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="時間帯別の売上" style={{ marginBottom: 16 }} styles={{ body: { padding: 0 } }}>
            <Table<HourlySummary>
              rowKey="hour"
              dataSource={hourly.slice().sort((a, b) => a.hour - b.hour)}
              size="small"
              pagination={false}
              locale={{ emptyText: 'この日の売上はありません' }}
              columns={[
                {
                  title: '時間',
                  dataIndex: 'hour',
                  render: (value: number) => `${String(value).padStart(2, '0')}:00`,
                },
                {
                  title: '売上',
                  dataIndex: 'sales',
                  align: 'right',
                  render: (value: number) => <span className="tabular">{money(value)}</span>,
                },
                {
                  title: '客数',
                  dataIndex: 'guest_count',
                  align: 'right',
                  render: (value: number) => <span className="tabular">{value}</span>,
                },
              ]}
            />
          </Card>

          <Card title="コメント">
            <Input.TextArea
              rows={4}
              value={draft}
              placeholder="気づいたことを書いておくと、翌日の引き継ぎに使えます"
              onChange={(e) => setDraft(e.target.value)}
            />
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Button type="primary" loading={pending} disabled={!shopId} onClick={save}>
                保存
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );
}
