'use client';

import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Space, Table, Tag } from 'antd';

import { PageHeader } from '@/components/PageHeader';
import type { OptionRow } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/** オプション一覧（仕様書 §5.5 / 画像 05_option_list.jpg） */
export function OptionListView({
  options,
  companyName,
}: {
  options: OptionRow[];
  companyName: string;
}) {
  return (
    <>
      <PageHeader
        title="オプション"
        description="メニューに付ける選択肢のまとまり。最小・最大選択数で必須かどうかが決まります"
        breadcrumb={[{ label: companyName }, { label: 'メニューマスター' }, { label: 'オプション' }]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} disabled>
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
                  {value}
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
          ]}
        />
      </Card>
    </>
  );
}
