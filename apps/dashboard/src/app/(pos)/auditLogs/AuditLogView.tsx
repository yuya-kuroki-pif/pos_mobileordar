'use client';

import { DownloadOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Flex, Select, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import type { AuditLogRow } from '@/lib/transactionQueries';
import { AUDIT_EVENT_LABELS, type AuditEvent, type Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

const EVENT_COLOR: Partial<Record<AuditEvent, string>> = {
  void: 'red',
  discount: 'orange',
  table_clear: 'purple',
  accounting_modify: 'gold',
};

/** 重要操作履歴一覧（仕様書 §5.26） */
export function AuditLogView({
  rows,
  shops,
  filter,
  companyName,
}: {
  rows: AuditLogRow[];
  shops: Shop[];
  filter: { shop?: string; event?: string; from?: string; to?: string };
  companyName: string;
}) {
  const router = useRouter();

  function go(next: Partial<typeof filter>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filter, ...next })) {
      if (value) params.set(key, String(value));
    }
    router.push(`/auditLogs?${params.toString()}`);
  }

  function downloadCsv() {
    const header = [
      '店舗',
      'イベント種別',
      '発生日時',
      'テーブル',
      '実行者',
      '金額',
      'レシート番号',
      '理由・備考',
    ];
    const body = rows.map((row) =>
      [
        row.shop_name,
        AUDIT_EVENT_LABELS[row.event_type],
        dayjs(row.occurred_at).format('YYYY/MM/DD HH:mm'),
        row.table_name ?? '',
        row.clerk_name ?? '',
        row.amount ?? '',
        row.receipt_number ?? '',
        row.note ?? '',
      ].join(',')
    );

    const blob = new Blob(['\ufeff' + [header.join(','), ...body].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit-logs.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="重要操作履歴一覧"
        description="ドロワーオープン・値引き・VOID など、あとから確かめたい操作の記録"
        breadcrumb={[{ label: companyName }, { label: '本部機能' }, { label: '重要操作履歴一覧' }]}
        extra={
          <Button icon={<DownloadOutlined />} disabled={rows.length === 0} onClick={downloadCsv}>
            CSV
          </Button>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Flex gap={8} wrap style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Select
            placeholder="店舗"
            allowClear
            value={filter.shop}
            style={{ width: 220 }}
            onChange={(value) => go({ shop: value ?? '' })}
            options={shops.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            placeholder="イベント種別"
            allowClear
            value={filter.event}
            style={{ width: 200 }}
            onChange={(value) => go({ event: value ?? '' })}
            options={Object.entries(AUDIT_EVENT_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <DatePicker.RangePicker
            value={filter.from && filter.to ? [dayjs(filter.from), dayjs(filter.to)] : null}
            onChange={(value) =>
              go({
                from: value?.[0] ? value[0].format('YYYY-MM-DD') : '',
                to: value?.[1] ? value[1].format('YYYY-MM-DD') : '',
              })
            }
          />
        </Flex>

        <Table<AuditLogRow>
          rowKey="id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} 件` }}
          columns={[
            { title: '店舗', dataIndex: 'shop_name', width: 200, fixed: 'left' },
            {
              title: 'イベント種別',
              dataIndex: 'event_type',
              width: 160,
              render: (value: AuditEvent) => (
                <Tag color={EVENT_COLOR[value]}>{AUDIT_EVENT_LABELS[value]}</Tag>
              ),
            },
            {
              title: '発生日時',
              dataIndex: 'occurred_at',
              width: 170,
              render: (value: string) => dayjs(value).format('YYYY/MM/DD HH:mm'),
            },
            {
              title: 'テーブル',
              dataIndex: 'table_name',
              width: 130,
              render: (value: string | null) => value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
            },
            {
              title: '実行者',
              dataIndex: 'clerk_name',
              width: 120,
              render: (value: string | null) => value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
            },
            {
              title: '金額',
              dataIndex: 'amount',
              width: 120,
              align: 'right',
              render: (value: number | null) =>
                value === null ? (
                  <span style={{ color: '#bfbfbf' }}>—</span>
                ) : (
                  <span className="tabular">¥{yen.format(value)}</span>
                ),
            },
            {
              title: 'レシート番号',
              dataIndex: 'receipt_number',
              width: 130,
              render: (value: number | null) =>
                value === null ? (
                  <span style={{ color: '#bfbfbf' }}>—</span>
                ) : (
                  <span className="tabular">{value}</span>
                ),
            },
            { title: '理由・備考', dataIndex: 'note' },
          ]}
        />
      </Card>

      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
        直近 300 件まで表示します。期間で絞り込むと古い記録も見られます。
      </Typography.Paragraph>
    </>
  );
}
