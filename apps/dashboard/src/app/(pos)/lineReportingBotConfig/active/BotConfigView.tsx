'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { TimeMinInput } from '@/components/TimeMinInput';
import { deleteBotConfigAction, saveBotConfigAction } from '@/lib/actions/lineReport';
import { minToLabel } from '@/lib/time';
import type { LineReportingBotConfig, Shop } from '@/lib/types';

const ITEMS: { key: string; label: string }[] = [
  { key: 'sales', label: '売上' },
  { key: 'guests', label: '客数' },
  { key: 'groups', label: '組数' },
  { key: 'average', label: '客単価' },
  { key: 'target', label: '目標達成率' },
  { key: 'topMenus', label: '売れ筋メニュー' },
];

/** レポートくん設定（仕様書 §5.27）。LINE グループへ日報を送る */
export function BotConfigView({
  configs,
  shops,
  companyName,
  editable,
}: {
  configs: LineReportingBotConfig[];
  shops: Shop[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function openModal(row: LineReportingBotConfig | null) {
    setEditingId(row?.id ?? null);
    setOpen(true);
    form.setFieldsValue({
      group_name: row?.group_name ?? '',
      line_group_id: row?.line_group_id ?? '',
      shop_ids: row?.shop_ids ?? [],
      send_time_min: row?.send_time_min ?? 23 * 60,
      items: ITEMS.filter((item) => row?.items?.[item.key] ?? true).map((item) => item.key),
      is_active: row?.is_active ?? true,
    });
  }

  function submit() {
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveBotConfigAction({
          id: editingId ?? '',
          group_name: values.group_name,
          line_group_id: values.line_group_id ?? '',
          shop_ids: values.shop_ids ?? [],
          send_time_min: values.send_time_min ?? 23 * 60,
          items: Object.fromEntries(
            ITEMS.map((item) => [item.key, (values.items ?? []).includes(item.key)])
          ),
          is_active: values.is_active ?? true,
        });
        if (!result.ok) {
          message.error(result.error ?? '保存できませんでした');
          return;
        }
        message.success('保存しました');
        setOpen(false);
        router.refresh();
      });
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteBotConfigAction(id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  function table(rows: LineReportingBotConfig[]) {
    return (
      <Card styles={{ body: { padding: 0 } }}>
        <Table<LineReportingBotConfig>
          rowKey="id"
          dataSource={rows}
          size="middle"
          pagination={false}
          locale={{ emptyText: '設定がありません' }}
          columns={[
            { title: 'グループ名', dataIndex: 'group_name', width: 220 },
            {
              title: '対象店舗',
              dataIndex: 'shop_ids',
              render: (value: string[]) => (
                <Space size={4} wrap>
                  {value.map((id) => (
                    <Tag key={id}>{shops.find((s) => s.id === id)?.name ?? id}</Tag>
                  ))}
                  {value.length === 0 && <span style={{ color: '#bfbfbf' }}>—</span>}
                </Space>
              ),
            },
            {
              title: '送信時刻',
              dataIndex: 'send_time_min',
              width: 110,
              render: (value: number) => <span className="tabular">{minToLabel(value)}</span>,
            },
            {
              title: '送信内容',
              dataIndex: 'items',
              width: 240,
              render: (value: Record<string, boolean>) => (
                <Space size={4} wrap>
                  {ITEMS.filter((item) => value?.[item.key]).map((item) => (
                    <Tag key={item.key} color="blue">
                      {item.label}
                    </Tag>
                  ))}
                </Space>
              ),
            },
            {
              title: '',
              key: 'actions',
              width: 100,
              render: (_, row) => (
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    disabled={!editable}
                    onClick={() => openModal(row)}
                  />
                  <Popconfirm
                    title="この設定を削除しますか？"
                    onConfirm={() => remove(row.id)}
                    disabled={!editable}
                  >
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={!editable} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="レポートくん設定"
        description="その日の売上を、営業終了後に LINE グループへ送ります"
        breadcrumb={[{ label: companyName }, { label: '本部機能' }, { label: 'レポートくん設定' }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!editable}
            onClick={() => openModal(null)}
          >
            新規作成
          </Button>
        }
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="LINE への送信は未実装です"
        description="設定は保存されますが、実際にメッセージを送る仕組み（LINE Messaging API との接続）はまだ動いていません。"
      />

      <Tabs
        items={[
          { key: 'active', label: '予約中', children: table(configs.filter((c) => c.is_active)) },
          { key: 'inactive', label: '停止中', children: table(configs.filter((c) => !c.is_active)) },
        ]}
      />

      <Modal
        open={open}
        title={editingId ? 'レポートくんを編集' : 'レポートくんを新規作成'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={submit}
        onCancel={() => setOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="group_name"
            label="グループ名"
            rules={[{ required: true, message: 'グループ名を入力してください' }]}
          >
            <Input placeholder="例: 錦糸町 店長グループ" />
          </Form.Item>

          <Form.Item name="shop_ids" label="対象店舗">
            <Select
              mode="multiple"
              allowClear
              placeholder="店舗を選択"
              options={shops.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>

          <Form.Item
            name="send_time_min"
            label="送信時刻"
            extra="24 時を超える場合は 25:00 のように書きます"
          >
            <TimeMinInput disabled={!editable} placeholder="23:00" />
          </Form.Item>

          <Form.Item name="items" label="送信内容">
            <Checkbox.Group options={ITEMS.map((i) => ({ value: i.key, label: i.label }))} />
          </Form.Item>

          <Form.Item name="line_group_id" label="LINE グループ ID">
            <Input placeholder="Cxxxxxxxx..." />
          </Form.Item>

          <Form.Item name="is_active" label="予約中にする" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
