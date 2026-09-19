'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { TimeMinInput } from '@/components/TimeMinInput';
import {
  deleteAppetizerAction,
  saveAppetizerAction,
  setShopAppetizerAction,
} from '@/lib/actions/companySettings';
import type { AppetizerBoard } from '@/lib/companyQueries';
import { minToLabel } from '@/lib/time';
import type { CompulsoryAppetizer, Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/**
 * お通し自動設定（仕様書 §5.9）。
 * テーブルを立ち上げたときに、人数ぶんのお通しを自動で注文する。
 */
export function AppetizerView({
  board,
  shops,
  menus,
  companyName,
  editable,
}: {
  board: AppetizerBoard;
  shops: Shop[];
  menus: { id: string; name: string; price: number }[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState(board.shopLinks);
  const [pending, startTransition] = useTransition();

  function openModal(row: CompulsoryAppetizer | null) {
    setEditingId(row?.id ?? null);
    setOpen(true);
    form.setFieldsValue({
      name: row?.name ?? '',
      menu_id: row?.menu_id ?? undefined,
      price: row?.price ?? 400,
      start_min: row?.start_min ?? 17 * 60,
      end_min: row?.end_min ?? 23 * 60 + 30,
      display_order: row?.display_order ?? (board.appetizers.length + 1) * 10,
    });
  }

  function submit() {
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveAppetizerAction({
          id: editingId ?? '',
          name: values.name,
          menu_id: values.menu_id ?? null,
          price: values.price ?? 0,
          start_min: values.start_min ?? 0,
          end_min: values.end_min ?? 1860,
          display_order: values.display_order ?? 0,
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
      const result = await deleteAppetizerAction(id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  function toggleShop(shopId: string, appetizerId: string, value: boolean) {
    const before = links;
    setLinks((current) => {
      const found = current.find(
        (l) => l.shop_id === shopId && l.appetizer_id === appetizerId
      );
      if (found) {
        return current.map((l) =>
          l === found ? { ...l, is_auto_order: value } : l
        );
      }
      return [...current, { shop_id: shopId, appetizer_id: appetizerId, is_auto_order: value }];
    });

    startTransition(async () => {
      const result = await setShopAppetizerAction(shopId, appetizerId, value);
      if (!result.ok) {
        setLinks(before);
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      router.refresh();
    });
  }

  const menuName = new Map(menus.map((m) => [m.id, m.name]));

  return (
    <>
      <PageHeader
        title="お通し自動設定"
        description="テーブルを立ち上げたときに、人数ぶんのお通しを自動で注文します"
        breadcrumb={[{ label: companyName }, { label: '業態管理' }, { label: 'お通し自動設定' }]}
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
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="時間帯ごとに違うお通しを出せます"
        description="開始・終了時間が重なる設定があると、先に並んでいる方が使われます。"
      />

      <Card title="お通しの設定" styles={{ body: { padding: 0 } }} style={{ marginBottom: 16 }}>
        <Table<CompulsoryAppetizer>
          rowKey="id"
          dataSource={board.appetizers}
          size="middle"
          pagination={false}
          columns={[
            { title: '設定名', dataIndex: 'name', width: 200 },
            {
              title: 'メニュー名',
              dataIndex: 'menu_id',
              render: (value: string | null) =>
                value ? (menuName.get(value) ?? '—') : <span style={{ color: '#bfbfbf' }}>未設定</span>,
            },
            {
              title: '価格',
              dataIndex: 'price',
              width: 120,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '時間帯',
              key: 'time',
              width: 160,
              render: (_, row) => (
                <span className="tabular">
                  {minToLabel(row.start_min)} 〜 {minToLabel(row.end_min)}
                </span>
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

      <Card title="店舗ごとの自動注文" styles={{ body: { padding: 0 } }}>
        <Table<Shop>
          rowKey="id"
          dataSource={shops}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            { title: '店舗名', dataIndex: 'name', width: 220, fixed: 'left' },
            ...board.appetizers.map((appetizer) => ({
              title: appetizer.name,
              key: appetizer.id,
              width: 180,
              render: (_: unknown, shop: Shop) => {
                const link = links.find(
                  (l) => l.shop_id === shop.id && l.appetizer_id === appetizer.id
                );
                return (
                  <Switch
                    checked={link?.is_auto_order ?? false}
                    disabled={!editable}
                    onChange={(checked) => toggleShop(shop.id, appetizer.id, checked)}
                  />
                );
              },
            })),
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={editingId ? 'お通しを編集' : 'お通しを新規作成'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={submit}
        onCancel={() => setOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="設定名"
            rules={[{ required: true, message: '設定名を入力してください' }]}
          >
            <Input placeholder="例: お通し（夜）" />
          </Form.Item>

          <Form.Item name="menu_id" label="メニュー" extra="伝票と売上に載せるメニュー">
            <Select
              allowClear
              optionFilterProp="label"
              placeholder="未設定"
              options={menus.map((m) => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>

          <Form.Item name="price" label="価格" extra="1 人あたりの金額">
            <InputNumber prefix="¥" min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="start_min" label="開始時間">
            <TimeMinInput disabled={!editable} />
          </Form.Item>

          <Form.Item
            name="end_min"
            label="終了時間"
            extra="24 時を超える場合は 25:00 のように書きます"
          >
            <TimeMinInput disabled={!editable} placeholder="23:30" />
          </Form.Item>

          <Form.Item name="display_order" label="表示順">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
