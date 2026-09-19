'use client';

import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Input, Select, Space, Table, Tag } from 'antd';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { canEdit, type PermissionMap } from '@/lib/permissions';
import type { PlanGroup, PlanRow } from '@/lib/types';

/**
 * プラン一覧（仕様書 §5.4 / 画像 04_plan_list.jpg）。
 * プラン = 飲み放題・コースなど、時間制限つきで複数カテゴリのメニューを
 * 0 円で注文できる商品。
 */
export function PlanListView({
  plans,
  groups,
  companyName,
  permissions,
}: {
  plans: PlanRow[];
  groups: PlanGroup[];
  companyName: string;
  permissions: PermissionMap;
}) {
  const [keyword, setKeyword] = useState('');
  const [groupId, setGroupId] = useState<string | undefined>();

  const editable = canEdit(permissions, 'menu_master');

  const rows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return plans.filter((plan) => {
      if (groupId && plan.plan_group_id !== groupId) return false;
      if (needle && !plan.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [plans, keyword, groupId]);

  return (
    <>
      <PageHeader
        title="プラン"
        description="飲み放題・コースなど、時間制限つきで複数カテゴリのメニューを注文できる商品"
        breadcrumb={[{ label: companyName }, { label: 'メニューマスター' }, { label: 'プラン' }]}
        extra={
          <Space>
            <Button disabled>表示順編集</Button>
            <Link href="/plan/new/edit">
              <Button type="primary" icon={<PlusOutlined />} disabled={!editable}>
                新規作成
              </Button>
            </Link>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Flex gap={8} wrap style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Input.Search
            placeholder="プラン名"
            allowClear
            style={{ maxWidth: 240 }}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            placeholder="プラングループ"
            allowClear
            style={{ width: 180 }}
            value={groupId}
            onChange={setGroupId}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
          />
        </Flex>

        <Table<PlanRow>
          rowKey="id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            {
              title: 'プラン名',
              dataIndex: 'name',
              width: 220,
              fixed: 'left',
              render: (value: string, row) => <Link href={`/plan/${row.id}/edit`}>{value}</Link>,
            },
            {
              title: 'カテゴリ',
              dataIndex: 'category_name',
              width: 140,
              render: (value: string | null) =>
                value ? <Tag>{value}</Tag> : <span style={{ color: '#bfbfbf' }}>未設定</span>,
            },
            {
              title: 'オプション',
              key: 'options',
              width: 160,
              render: (_, row) => (
                <Space size={4} wrap>
                  {row.option_names.map((name) => (
                    <Tag key={name} color="blue">
                      {name}
                    </Tag>
                  ))}
                  {row.option_names.length === 0 && <span style={{ color: '#bfbfbf' }}>—</span>}
                </Space>
              ),
            },
            {
              title: 'プラン内カテゴリ',
              key: 'planCategories',
              width: 220,
              render: (_, row) => (
                <Space size={4} wrap>
                  {row.plan_category_names.map((name) => (
                    <Tag key={name}>{name}</Tag>
                  ))}
                  {row.plan_category_names.length === 0 && (
                    <span style={{ color: '#bfbfbf' }}>—</span>
                  )}
                </Space>
              ),
            },
            {
              title: '制限時間',
              key: 'timeLimit',
              width: 110,
              render: (_, row) =>
                row.has_time_limit && row.time_limit_min ? (
                  <span className="tabular">{row.time_limit_min} 分</span>
                ) : (
                  <Tag>無制限</Tag>
                ),
            },
            {
              title: 'プラングループ',
              dataIndex: 'plan_group_name',
              width: 150,
              render: (value: string | null) =>
                value ?? <span style={{ color: '#bfbfbf' }}>—</span>,
            },
            {
              title: '取扱店舗',
              dataIndex: 'dealing_shop_count',
              width: 100,
              align: 'right',
              render: (value: number) => <span className="tabular">{value} 店舗</span>,
            },
          ]}
        />
      </Card>
    </>
  );
}
