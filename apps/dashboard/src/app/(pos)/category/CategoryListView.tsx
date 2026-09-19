'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Popconfirm, Space, Table, Tag } from 'antd';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import { deleteCategoryAction } from '@/lib/actions/category';
import { canEdit, type PermissionMap } from '@/lib/permissions';
import type { CategoryRow, MenuRow } from '@/lib/types';

import { CategoryEditDrawer } from './CategoryEditDrawer';

/** カテゴリ一覧（仕様書 §5.6 / 画像 06_category_list.jpg） */
export function CategoryListView({
  categories,
  menus,
  companyName,
  permissions,
}: {
  categories: CategoryRow[];
  menus: MenuRow[];
  companyName: string;
  permissions: PermissionMap;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<{
    open: boolean;
    row: CategoryRow | null;
  }>({
    open: false,
    row: null,
  });
  const [, startTransition] = useTransition();

  const editable = canEdit(permissions, 'menu_master');

  function remove(categoryId: string) {
    startTransition(async () => {
      const result = await deleteCategoryAction(categoryId);
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
        title="カテゴリ"
        description="メニューを並べる区分。ハンディとキッチンディスプレイの表示色もここで決めます"
        breadcrumb={[{ label: companyName }, { label: 'メニューマスター' }, { label: 'カテゴリ' }]}
        extra={
          <Space>
            <Button disabled>表示順編集</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!editable}
              onClick={() => setEditing({ open: true, row: null })}
            >
              新規作成
            </Button>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CategoryRow>
          rowKey="id"
          dataSource={categories}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            {
              title: 'カテゴリ名',
              dataIndex: 'name',
              width: 180,
              fixed: 'left',
              render: (value: string, row) => (
                <Space size={4}>
                  <a onClick={() => setEditing({ open: true, row })}>{value}</a>
                  {!row.is_active && <Tag>無効</Tag>}
                </Space>
              ),
            },
            {
              title: 'スタッフ表示名',
              dataIndex: 'staff_display_name',
              width: 160,
              render: (value: string | null) =>
                value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
            },
            {
              title: 'メニュー一覧',
              key: 'menus',
              render: (_, row) => (
                <Space size={4} wrap>
                  {row.menu_names.slice(0, 6).map((name) => (
                    <Tag key={name}>{name}</Tag>
                  ))}
                  {row.menu_names.length > 6 && <span>他 {row.menu_names.length - 6} 件</span>}
                  {row.menu_names.length === 0 && <span style={{ color: '#bfbfbf' }}>—</span>}
                </Space>
              ),
            },
            {
              title: 'メニュー数',
              key: 'count',
              width: 100,
              align: 'right',
              render: (_, row) => <span className="tabular">{row.menu_names.length}</span>,
            },
            {
              title: 'ハンディ背景色',
              dataIndex: 'handy_bg_color',
              width: 140,
              render: (value: string | null) =>
                value ? (
                  <Space size={6}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: value,
                        border: '1px solid #d9d9d9',
                      }}
                    />
                    <span className="tabular">{value}</span>
                  </Space>
                ) : (
                  <span style={{ color: '#bfbfbf' }}>未設定</span>
                ),
            },
            {
              title: '',
              key: 'actions',
              width: 90,
              fixed: 'right',
              render: (_, row) => (
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    disabled={!editable}
                    onClick={() => setEditing({ open: true, row })}
                  />
                  <Popconfirm
                    title="このカテゴリを削除しますか？"
                    description="メニューそのものは残りますが、このカテゴリからは外れます。"
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

      <CategoryEditDrawer
        open={editing.open}
        category={editing.row}
        menus={menus}
        onClose={() => setEditing((c) => ({ ...c, open: false }))}
      />
    </>
  );
}
