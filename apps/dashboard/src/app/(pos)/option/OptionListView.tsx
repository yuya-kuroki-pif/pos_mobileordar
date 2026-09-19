'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Popconfirm, Space, Table, Tag } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { deleteOptionAction } from '@/lib/actions/option';
import { canEdit, type PermissionMap } from '@/lib/permissions';
import type { MenuRow, OptionRow } from '@/lib/types';

import { OptionEditDrawer } from './OptionEditDrawer';

const yen = new Intl.NumberFormat('ja-JP');

/** オプション一覧（仕様書 §5.5 / 画像 05_option_list.jpg） */
export function OptionListView({
  options,
  menus,
  companyName,
  permissions,
}: {
  options: OptionRow[];
  menus: MenuRow[];
  companyName: string;
  permissions: PermissionMap;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<{ open: boolean; row: OptionRow | null }>({
    open: false,
    row: null,
  });
  const [, startTransition] = useTransition();

  const editable = canEdit(permissions, 'menu_master');

  function remove(optionId: string) {
    startTransition(async () => {
      const result = await deleteOptionAction(optionId);
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
        title="オプション"
        description="メニューに付ける選択肢のまとまり。最小・最大選択数で必須かどうかが決まります"
        breadcrumb={[
          { label: companyName },
          { label: 'メニューマスター' },
          { label: 'オプション' },
        ]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!editable}
            onClick={() => setEditing({ open: true, row: null })}
          >
            新規作成
          </Button>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<OptionRow>
          rowKey="id"
          dataSource={options}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            {
              title: 'オプション名',
              dataIndex: 'name',
              width: 180,
              fixed: 'left',
              render: (value: string, row) => (
                <Space size={4}>
                  <a onClick={() => setEditing({ open: true, row })}>{value}</a>
                  {row.min_choice > 0 && <Tag color="red">必須</Tag>}
                </Space>
              ),
            },
            {
              title: '選択数',
              key: 'range',
              width: 120,
              render: (_, row) => (
                <span className="tabular">
                  {row.min_choice} 〜 {row.max_choice}
                </span>
              ),
            },
            {
              title: '選択肢',
              key: 'choices',
              render: (_, row) => (
                <Space size={4} wrap>
                  {row.choices.map((choice) => (
                    <Tag key={choice.id} color={choice.is_default ? 'blue' : undefined}>
                      {choice.name}
                      {choice.price !== 0 && ` +${yen.format(choice.price)}円`}
                    </Tag>
                  ))}
                  {row.choices.length === 0 && <span style={{ color: '#bfbfbf' }}>—</span>}
                </Space>
              ),
            },
            {
              title: '紐づいているメニュー',
              key: 'menus',
              width: 260,
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
                    title="このオプションを削除しますか？"
                    description="選択肢と、メニューへの紐付けも一緒に消えます。"
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

      <OptionEditDrawer
        open={editing.open}
        option={editing.row}
        menus={menus}
        onClose={() => setEditing((c) => ({ ...c, open: false }))}
      />
    </>
  );
}
