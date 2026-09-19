'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Input, InputNumber, Modal, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  deleteNameListAction,
  saveNameListAction,
  type NameListKind,
} from '@/lib/actions/payment';
import type { DiscountType, InflowSource } from '@/lib/types';

type Row = DiscountType | InflowSource;

/**
 * 割引方法（/onSitePaymentDiscountType）と媒体（/inflowSourceTag）。
 * どちらも「名前だけの一覧」で形が同じなので、1 つの表で扱う。
 */
export function NameListTable({
  kind,
  label,
  description,
  rows,
  editable,
}: {
  kind: NameListKind;
  label: string;
  description: string;
  rows: Row[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<{ id: string; name: string; order: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!editing) return;
    startTransition(async () => {
      const result = await saveNameListAction(kind, {
        id: editing.id,
        name: editing.name,
        display_order: editing.order,
      });
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteNameListAction(kind, id);
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
      <Card
        styles={{ body: { padding: 0 } }}
        title={label}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!editable}
            onClick={() => setEditing({ id: '', name: '', order: (rows.length + 1) * 10 })}
          >
            新規作成
          </Button>
        }
      >
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, padding: '12px 16px', margin: 0 }}
        >
          {description}
        </Typography.Paragraph>

        <Table<Row>
          rowKey="id"
          dataSource={rows}
          size="middle"
          pagination={false}
          columns={[
            {
              title: `${label}名`,
              dataIndex: 'name',
              render: (value: string, row) => (
                <Space size={4}>
                  {value}
                  {row.is_system && <Tag>既定</Tag>}
                </Space>
              ),
            },
            { title: '表示順', dataIndex: 'display_order', width: 100, align: 'right' },
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
                    onClick={() =>
                      setEditing({ id: row.id, name: row.name, order: row.display_order })
                    }
                  />
                  <Popconfirm
                    title={`この${label}を削除しますか？`}
                    onConfirm={() => remove(row.id)}
                    disabled={!editable || row.is_system}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      disabled={!editable || row.is_system}
                    />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={editing !== null}
        title={editing?.id ? `${label}を編集` : `${label}を新規作成`}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={submit}
        onCancel={() => setEditing(null)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            value={editing?.name ?? ''}
            placeholder={`${label}名`}
            onChange={(e) => setEditing((c) => (c ? { ...c, name: e.target.value } : c))}
            onPressEnter={submit}
          />
          <InputNumber
            value={editing?.order ?? 0}
            addonBefore="表示順"
            style={{ width: '100%' }}
            onChange={(value) => setEditing((c) => (c ? { ...c, order: value ?? 0 } : c))}
          />
        </Space>
      </Modal>
    </>
  );
}
