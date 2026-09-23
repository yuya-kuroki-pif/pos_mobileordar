'use client';

import { DeleteOutlined, DownloadOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert, App, Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Radio, Select, Space, Table, Tabs, Tag,
} from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import {
  deleteCustomReportAction,
  saveCustomReportAction,
} from '@/lib/actions/customReport';
import { runCustomReportAction } from '@/lib/actions/runReport';
import { REPORT_METRICS, REPORT_SOURCES } from '@/lib/reportDefs';
import { downloadCsv, toCsv } from '@/lib/downloadCsv';
import type { CustomReport } from '@/lib/types';

type Source = 'sales' | 'menu' | 'survey';

interface FormValues {
  name: string;
  share_scope: 'private' | 'corporation';
  source: Source;
  metrics: string[];
  group_by: string;
  shop_ids: string[];
}

const metricsFor = (source: Source) =>
  Object.entries(REPORT_METRICS)
    .filter(([, meta]) => meta.source === source)
    .map(([value, meta]) => ({ value, label: meta.label }));

/** カスタムレポート（仕様書 §6.9）。保存した組み合わせをその場で実行できる */
export function CustomReportsView({
  companyName,
  reports,
  shops,
  myAccountId,
  editable,
}: {
  companyName: string;
  reports: CustomReport[];
  shops: { id: string; name: string }[];
  myAccountId: string;
  editable: boolean;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomReport | null>(null);
  const [month, setMonth] = useState(dayjs());
  const [result, setResult] = useState<{
    name: string;
    columns: { key: string; label: string }[];
    rows: Record<string, string | number>[];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = reports.filter((report) =>
    tab === 'mine'
      ? report.owner_account_id === myAccountId
      : tab === 'shared'
        ? report.share_scope === 'corporation' && report.owner_account_id !== myAccountId
        : true
  );

  function openModal(report: CustomReport | null) {
    setEditing(report);
    form.setFieldsValue({
      name: report?.name ?? '',
      share_scope: report?.share_scope ?? 'private',
      source: (report?.definition.source ?? 'sales') as Source,
      metrics: report?.definition.metrics ?? ['sales'],
      group_by: report?.definition.group_by ?? 'shop',
      shop_ids: report?.definition.shop_ids ?? [],
    });
    setOpen(true);
  }

  function submit() {
    form.validateFields().then((values) => {
      startTransition(async () => {
        const saved = await saveCustomReportAction({ id: editing?.id ?? '', ...values });
        if (!saved.ok) {
          message.error(saved.error ?? 'レポートを保存できませんでした');
          return;
        }
        message.success('レポートを保存しました。');
        setOpen(false);
        router.refresh();
      });
    });
  }

  function run(report: CustomReport) {
    startTransition(async () => {
      const output = await runCustomReportAction(report.definition, month.format('YYYY-MM'));
      if (!output.ok || !output.columns || !output.rows) {
        message.error(output.error ?? 'レポートを実行できませんでした');
        return;
      }
      setResult({ name: report.name, columns: output.columns, rows: output.rows });
    });
  }

  function remove(report: CustomReport) {
    startTransition(async () => {
      const deleted = await deleteCustomReportAction(report.id);
      if (!deleted.ok) {
        message.error(deleted.error ?? 'レポートを削除できませんでした');
        return;
      }
      message.success('レポートを削除しました。');
      if (result?.name === report.name) setResult(null);
      router.refresh();
    });
  }

  function exportResult() {
    if (!result) return;
    downloadCsv(
      `${result.name}_${month.format('YYYY-MM')}.csv`,
      toCsv(
        result.columns.map((c) => c.label),
        result.rows.map((row) => result.columns.map((c) => row[c.key] ?? ''))
      )
    );
  }

  return (
    <>
      <PageHeader
        title="カスタムレポート"
        description="よく見る指標の組み合わせを保存しておき、必要なときに実行します"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: 'カスタムレポート' }]}
        extra={
          <Space>
            <DatePicker
              picker="month"
              value={month}
              allowClear={false}
              onChange={(value) => value && setMonth(value)}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal(null)}
              disabled={!editable}
            >
              新規レポート
            </Button>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }} style={{ marginBottom: 16 }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          style={{ padding: '0 16px' }}
          items={[
            { key: 'all', label: 'すべて' },
            { key: 'mine', label: '自分のレポート' },
            { key: 'shared', label: '共有されたレポート' },
          ]}
        />
        <Table<CustomReport>
          rowKey="id"
          dataSource={visible}
          size="middle"
          pagination={false}
          locale={{ emptyText: 'レポートがありません' }}
          columns={[
            { title: 'レポート名', dataIndex: 'name', width: 280 },
            {
              title: '区分',
              key: 'source',
              width: 120,
              render: (_, row) => <Tag>{REPORT_SOURCES[row.definition.source]}</Tag>,
            },
            {
              title: '指標',
              key: 'metrics',
              render: (_, row) => (
                <Space size={4} wrap>
                  {row.definition.metrics.map((metric) => (
                    <Tag key={metric} color="blue">
                      {REPORT_METRICS[metric]?.label ?? metric}
                    </Tag>
                  ))}
                </Space>
              ),
            },
            {
              title: '共有範囲',
              key: 'share',
              width: 120,
              render: (_, row) => (
                <Tag color={row.share_scope === 'corporation' ? 'green' : undefined}>
                  {row.share_scope === 'corporation' ? '法人全体' : '自分のみ'}
                </Tag>
              ),
            },
            { title: '作成者', dataIndex: 'owner_name', width: 140 },
            {
              title: '最終更新',
              key: 'updated',
              width: 140,
              render: (_, row) => row.updated_at.slice(0, 10),
            },
            {
              title: '',
              key: 'actions',
              width: 200,
              render: (_, row) => (
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => run(row)}
                    loading={pending}
                  >
                    実行
                  </Button>
                  <Button size="small" onClick={() => openModal(row)} disabled={!editable}>
                    編集
                  </Button>
                  <Popconfirm
                    title="このレポートを削除しますか？"
                    onConfirm={() => remove(row)}
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

      {result && (
        <Card
          title={`${result.name} — ${month.format('YYYY年M月')}`}
          styles={{ body: { padding: 0 } }}
          extra={
            <Button size="small" icon={<DownloadOutlined />} onClick={exportResult}>
              CSV
            </Button>
          }
        >
          <Table
            rowKey={(row) => String(row.label)}
            dataSource={result.rows}
            size="middle"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={result.columns.map((column, index) => ({
              title: column.label,
              dataIndex: column.key,
              width: index === 0 ? 240 : 140,
              align: index === 0 ? undefined : ('right' as const),
              render: (value: string | number) =>
                typeof value === 'number' ? (
                  <span className="tabular">{value.toLocaleString('ja-JP')}</span>
                ) : (
                  value
                ),
            }))}
          />
        </Card>
      )}

      <Modal
        title={editing ? 'レポートを編集' : '新規レポート'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={pending}
        okText="保存"
        cancelText="キャンセル"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="レポート名"
            rules={[{ required: true, message: 'レポート名を入力してください' }]}
          >
            <Input placeholder="例: 店舗別 売上と客単価（月次）" />
          </Form.Item>

          <Form.Item name="source" label="集計のもと">
            <Radio.Group
              optionType="button"
              options={Object.entries(REPORT_SOURCES).map(([value, label]) => ({ value, label }))}
              onChange={() => form.setFieldValue('metrics', [])}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, next) => prev.source !== next.source}>
            {({ getFieldValue }) => (
              <>
                <Form.Item
                  name="metrics"
                  label="指標"
                  rules={[{ required: true, message: '指標を 1 つ以上選んでください' }]}
                >
                  <Select mode="multiple" options={metricsFor(getFieldValue('source'))} />
                </Form.Item>

                {getFieldValue('source') === 'menu' && (
                  <Form.Item name="group_by" label="まとめ方">
                    <Radio.Group
                      optionType="button"
                      options={[
                        { value: 'menu', label: 'メニュー別' },
                        { value: 'category', label: 'カテゴリ別' },
                      ]}
                    />
                  </Form.Item>
                )}
              </>
            )}
          </Form.Item>

          <Form.Item
            name="shop_ids"
            label="対象の店舗"
            help="選ばないと、いま見ている業態の全店舗が対象になります"
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="全店舗"
              options={shops.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>

          <Form.Item name="share_scope" label="共有範囲">
            <Radio.Group
              optionType="button"
              options={[
                { value: 'private', label: '自分のみ' },
                { value: 'corporation', label: '法人全体' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {!editable && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="閲覧のみの権限です"
          description="保存されたレポートの実行はできますが、新規作成・編集はできません。"
        />
      )}
    </>
  );
}
