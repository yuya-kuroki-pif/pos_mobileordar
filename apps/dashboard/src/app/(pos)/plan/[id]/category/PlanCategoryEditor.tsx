'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Input, Modal, Popconfirm, Space, Table, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  deletePlanCategoryAction,
  savePlanCategoryAction,
} from '@/lib/actions/plan';
import type { PlanCategory, PlanMenuLink } from '@/lib/types';

/**
 * プラン内カテゴリタブ（仕様書 §5.4）。
 * プランの中だけで使う区分（例: 「ドリンク」「フード」）を並べる。
 * 実際にどのメニューを入れるかは「プラン内メニュー」タブで決める。
 */
export function PlanCategoryEditor({
  planId,
  categories,
  menus,
  editable,
}: {
  planId: string;
  categories: PlanCategory[];
  menus: PlanMenuLink[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!editing) return;
    const { id, name } = editing;
    startTransition(async () => {
      const result = await savePlanCategoryAction(planId, id, name);
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      setEditing(null);
      message.success('保存しました');
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deletePlanCategoryAction(planId, id);
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
        style={{ marginTop: 16 }}
        styles={{ body: { padding: 0 } }}
        title="プラン内カテゴリ"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!editable}
            onClick={() => setEditing({ id: '', name: '' })}
          >
            追加
          </Button>
        }
      >
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, padding: '12px 16px', margin: 0 }}
        >
          カテゴリを削除すると、そこに入っていたプラン内メニューも一緒に外れます。
        </Typography.Paragraph>

        <Table<PlanCategory>
          rowKey="id"
          dataSource={categories}
          size="middle"
          pagination={false}
          columns={[
            { title: 'カテゴリ名', dataIndex: 'name' },
            {
              title: 'メニュー数',
              key: 'count',
              width: 120,
              align: 'right',
              render: (_, row) => (
                <span className="tabular">
                  {menus.filter((m) => m.plan_category_id === row.id).length} 品
                </span>
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
                    onClick={() => setEditing({ id: row.id, name: row.name })}
                  />
                  <Popconfirm
                    title="このカテゴリを削除しますか？"
                    onConfirm={() => remove(row.id)}
                    disabled={!editable}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      disabled={!editable}
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
        title={editing?.id ? 'カテゴリ名を変更' : 'プラン内カテゴリを追加'}
        okText="保存"
        cancelText="キャンセル"
        confirmLoading={pending}
        onOk={submit}
        onCancel={() => setEditing(null)}
      >
        <Input
          value={editing?.name ?? ''}
          placeholder="例: ドリンク"
          onChange={(e) => setEditing((c) => (c ? { ...c, name: e.target.value } : c))}
          onPressEnter={submit}
        />
      </Modal>
    </>
  );
}
