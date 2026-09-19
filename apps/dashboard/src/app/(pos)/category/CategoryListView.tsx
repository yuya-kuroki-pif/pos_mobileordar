'use client';

import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Space, Table, Tag } from 'antd';

import { PageHeader } from '@/components/PageHeader';
import type { CategoryRow } from '@/lib/types';

/** カテゴリ一覧（仕様書 §5.6 / 画像 06_category_list.jpg） */
export function CategoryListView({
  categories,
  companyName,
}: {
  categories: CategoryRow[];
  companyName: string;
}) {
  return (
    <>
      <PageHeader
        title="カテゴリ"
        description="メニューを並べる区分。ハンディとキッチンディスプレイの表示色もここで決めます"
        breadcrumb={[{ label: companyName }, { label: 'メニューマスター' }, { label: 'カテゴリ' }]}
        extra={
          <Space>
            <Button disabled>表示順編集</Button>
            <Button type="primary" icon={<PlusOutlined />} disabled>
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
            { title: 'カテゴリ名', dataIndex: 'name', width: 180, fixed: 'left' },
            {
              title: 'スタッフ表示名',
              dataIndex: 'staff_display_name',
              width: 160,
              render: (value: string | null) => value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
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
          ]}
        />
      </Card>
    </>
  );
}
