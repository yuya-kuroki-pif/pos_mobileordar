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
  Tag,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import {
  deleteRecommendationSetAction,
  saveRecommendationSetAction,
  setShopRecommendationAction,
} from '@/lib/actions/recommendation';
import type { RecommendationBoard } from '@/lib/recommendationQueries';
import type { Shop } from '@/lib/types';

type SetRow = RecommendationBoard['sets'][number];

/**
 * おすすめメニュー（仕様書 §5.7）。
 * ここで作ったセットが、モバイルオーダーのトップの「当店のおすすめ」に出る。
 */
export function RecommendationView({
  board,
  shops,
  menus,
  companyName,
  editable,
}: {
  board: RecommendationBoard;
  shops: Shop[];
  menus: { id: string; name: string }[];
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

  function openModal(row: SetRow | null) {
    setEditingId(row?.id ?? null);
    setOpen(true);
    form.setFieldsValue({
      name: row?.name ?? '',
      display_name: row?.display_name ?? '当店のおすすめ',
      display_order: row?.display_order ?? (board.sets.length + 1) * 10,
      menuIds: row?.menu_ids ?? [],
    });
  }

  function submit() {
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveRecommendationSetAction({
          id: editingId ?? '',
          name: values.name,
          display_name: values.display_name ?? '',
          display_order: values.display_order ?? 0,
          menuIds: values.menuIds ?? [],
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
      const result = await deleteRecommendationSetAction(id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  function patchShop(shopId: string, patch: { set_id?: string | null; is_visible?: boolean }) {
    const before = links;
    setLinks((current) => {
      const found = current.find((l) => l.shop_id === shopId);
      if (found) return current.map((l) => (l === found ? { ...l, ...patch } : l));
      return [...current, { shop_id: shopId, set_id: null, is_visible: false, ...patch }];
    });

    startTransition(async () => {
      const result = await setShopRecommendationAction(shopId, patch);
      if (!result.ok) {
        setLinks(before);
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="おすすめメニュー"
        description="モバイルオーダーのトップに出す「当店のおすすめ」を決めます"
        breadcrumb={[{ label: companyName }, { label: 'メニューマスター' }, { label: 'おすすめメニュー' }]}
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
        message="セットを作って、店舗ごとにどれを出すか選びます"
        description="店舗ごとに違うおすすめを出したいときは、セットを複数作って割り当ててください。"
      />

      <Card title="おすすめセット" styles={{ body: { padding: 0 } }} style={{ marginBottom: 16 }}>
        <Table<SetRow>
          rowKey="id"
          dataSource={board.sets}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            { title: 'おすすめセット名', dataIndex: 'name', width: 200 },
            {
              title: '表示名',
              dataIndex: 'display_name',
              width: 180,
              render: (value: string | null) =>
                value ?? <span style={{ color: '#bfbfbf' }}>未設定</span>,
            },
            {
              title: 'メニュー一覧',
              key: 'menus',
              render: (_, row) => (
                <Space size={4} wrap>
                  {row.menu_names.slice(0, 4).map((name) => (
                    <Tag key={name}>{name}</Tag>
                  ))}
                  {row.menu_names.length > 4 && <span>他 {row.menu_names.length - 4} 件</span>}
                  {row.menu_names.length === 0 && <span style={{ color: '#bfbfbf' }}>—</span>}
                </Space>
              ),
            },
            {
              title: 'メニュー数',
              key: 'count',
              width: 100,
              align: 'right',
              render: (_, row) => <span className="tabular">{row.menu_ids.length}</span>,
            },
            {
              title: '店舗数',
              key: 'shops',
              width: 90,
              align: 'right',
              render: (_, row) => (
                <span className="tabular">
                  {links.filter((l) => l.set_id === row.id && l.is_visible).length}
                </span>
              ),
            },
            {
              title: '',
              key: 'actions',
              width: 100,
              fixed: 'right',
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
                    title="このセットを削除しますか？"
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

      <Card title="店舗設定" styles={{ body: { padding: 0 } }}>
        <Table<Shop>
          rowKey="id"
          dataSource={shops}
          size="middle"
          pagination={false}
          columns={[
            { title: '店舗名', dataIndex: 'name' },
            {
              title: '公開設定',
              key: 'visible',
              width: 120,
              render: (_, shop) => {
                const link = links.find((l) => l.shop_id === shop.id);
                return (
                  <Switch
                    checked={link?.is_visible ?? false}
                    disabled={!editable}
                    onChange={(checked) => patchShop(shop.id, { is_visible: checked })}
                  />
                );
              },
            },
            {
              title: 'おすすめセット',
              key: 'set',
              width: 260,
              render: (_, shop) => {
                const link = links.find((l) => l.shop_id === shop.id);
                return (
                  <Select
                    allowClear
                    size="small"
                    placeholder="未設定"
                    value={link?.set_id ?? undefined}
                    disabled={!editable}
                    style={{ width: 220 }}
                    onChange={(value) => patchShop(shop.id, { set_id: value ?? null })}
                    options={board.sets.map((s) => ({ value: s.id, label: s.name }))}
                  />
                );
              },
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={editingId ? 'おすすめセットを編集' : 'おすすめセットを新規作成'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={submit}
        onCancel={() => setOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="おすすめセット名"
            rules={[{ required: true, message: 'おすすめセット名を入力してください' }]}
          >
            <Input placeholder="例: 定番おすすめ" />
          </Form.Item>

          <Form.Item name="display_name" label="表示名" extra="お客様の画面に出る見出し">
            <Input placeholder="当店のおすすめ" />
          </Form.Item>

          <Form.Item name="menuIds" label="メニュー">
            <Select
              mode="multiple"
              allowClear
              optionFilterProp="label"
              placeholder="メニューを選択"
              options={menus.map((m) => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>

          <Form.Item name="display_order" label="表示順">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
