'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { deleteHandyAction, issueHandyAccountAction } from '@/lib/actions/handy';
import type { HandyTerminal, Shop } from '@/lib/types';

const STATUS_LABEL: Record<string, { label: string; color?: string }> = {
  active: { label: '接続済み', color: 'blue' },
  inactive: { label: '未接続' },
};

/** ハンディ管理（仕様書 §5.18）。端末情報は端末が初回起動時に申告する */
export function HandyView({
  shops,
  shopId,
  terminals,
  companyName,
  editable,
}: {
  shops: Shop[];
  shopId?: string;
  terminals: HandyTerminal[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  function issue() {
    if (!shopId) return;
    startTransition(async () => {
      const result = await issueHandyAccountAction(shopId, name);
      if (!result.ok) {
        message.error(result.error ?? '発行できませんでした');
        return;
      }
      message.success('アカウントを発行しました');
      setOpen(false);
      setName('');
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!shopId) return;
    startTransition(async () => {
      const result = await deleteHandyAction(shopId, id);
      if (!result.ok) {
        message.error(result.error ?? '削除できませんでした');
        return;
      }
      message.success('削除しました');
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="ハンディ管理"
        description="店舗で使うハンディ端末の一覧。機種や OS は端末が初回起動時に申告します"
        breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: 'ハンディ管理' }]}
        extra={
          <Space>
            {shops.length > 0 && (
              <Select
                value={shopId}
                style={{ width: 220 }}
                onChange={(value) => router.push(`/handy?shop=${value}`)}
                options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
              />
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!editable || !shopId}
              onClick={() => setOpen(true)}
            >
              アカウント発行
            </Button>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<HandyTerminal>
          rowKey="id"
          dataSource={terminals}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            { title: 'ハンディ名', dataIndex: 'name', width: 160, fixed: 'left' },
            {
              title: '端末ID',
              dataIndex: 'device_id',
              width: 160,
              render: (value: string | null) =>
                value ?? <span style={{ color: '#bfbfbf' }}>未接続</span>,
            },
            {
              title: '状態',
              dataIndex: 'status',
              width: 110,
              render: (value: string) => {
                const status = STATUS_LABEL[value] ?? { label: value };
                return <Tag color={status.color}>{status.label}</Tag>;
              },
            },
            { title: 'バージョン', dataIndex: 'app_version', width: 120 },
            { title: 'ネイティブアプリ', dataIndex: 'native_version', width: 150 },
            { title: 'ブランド名', dataIndex: 'brand', width: 120 },
            { title: 'モデル名', dataIndex: 'model', width: 120 },
            { title: 'OS名', dataIndex: 'os_name', width: 100 },
            { title: 'OSバージョン', dataIndex: 'os_version', width: 130 },
            {
              title: '登録日時',
              dataIndex: 'registered_at',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString('ja-JP'),
            },
            {
              title: '',
              key: 'actions',
              width: 70,
              fixed: 'right',
              render: (_, row) => (
                <Popconfirm
                  title="このハンディを削除しますか？"
                  onConfirm={() => remove(row.id)}
                  disabled={!editable}
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} disabled={!editable} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title="ハンディのアカウント発行"
        okText="発行"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={issue}
        onCancel={() => setOpen(false)}
      >
        <Input
          value={name}
          placeholder="例: ハンディ1"
          onChange={(e) => setName(e.target.value)}
          onPressEnter={issue}
        />
      </Modal>
    </>
  );
}
