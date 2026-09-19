'use client';

import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Input, Segmented, Select, Space, Table, Tag } from 'antd';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { canEdit, type PermissionMap } from '@/lib/permissions';
import type { MenuRow, MenuTypeValue } from '@/lib/types';

const MENU_TYPE_LABEL: Record<MenuTypeValue, string> = {
  food: 'フード',
  drink: 'ドリンク',
  other: 'その他',
};

const MENU_TYPE_COLOR: Record<MenuTypeValue, string> = {
  food: 'orange',
  drink: 'blue',
  other: 'default',
};

const yen = new Intl.NumberFormat('ja-JP');

/**
 * メニュー一覧（仕様書 §5.2）。
 * 「簡易表示 / 詳細表示」で列を切り替える。詳細では伝票表示名・原価・税率などを足す。
 */
export function MenuListView({
  menus,
  companyName,
  permissions,
}: {
  menus: MenuRow[];
  companyName: string;
  permissions: PermissionMap;
}) {
  const [detail, setDetail] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [menuType, setMenuType] = useState<MenuTypeValue | undefined>();

  const editable = canEdit(permissions, 'menu_master');

  const categoryOptions = useMemo(() => {
    const names = new Set(menus.flatMap((m) => m.category_names));
    return [...names].map((name) => ({ value: name, label: name }));
  }, [menus]);

  const rows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return menus.filter((menu) => {
      if (category && !menu.category_names.includes(category)) return false;
      if (menuType && menu.menu_type !== menuType) return false;
      if (needle && !menu.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [menus, keyword, category, menuType]);

  return (
    <>
      <PageHeader
        title="メニュー"
        description="業態に属するメニューマスター。店舗ごとの取扱は各店舗の設定で切り替えます"
        breadcrumb={[{ label: companyName }, { label: 'メニューマスター' }, { label: 'メニュー' }]}
        extra={
          <Space>
            <Button disabled>表示順編集</Button>
            <Button type="primary" icon={<PlusOutlined />} disabled={!editable}>
              新規作成
            </Button>
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        message="編集画面は未実装です"
        description="一覧・絞り込み・表示切替までを実装しています。メニュー編集（基本情報 / オプション / 取扱設定 / 多言語）は続けて作ります。"
        style={{ marginBottom: 16 }}
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Flex gap={8} wrap align="center" style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Input.Search
            placeholder="メニュー名"
            allowClear
            style={{ maxWidth: 240 }}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            placeholder="カテゴリ"
            allowClear
            style={{ width: 160 }}
            value={category}
            onChange={setCategory}
            options={categoryOptions}
          />
          <Select
            placeholder="メニュータイプ"
            allowClear
            style={{ width: 160 }}
            value={menuType}
            onChange={setMenuType}
            options={(['food', 'drink', 'other'] as const).map((t) => ({
              value: t,
              label: MENU_TYPE_LABEL[t],
            }))}
          />
          <Segmented
            style={{ marginLeft: 'auto' }}
            value={detail ? 'detail' : 'simple'}
            onChange={(value) => setDetail(value === 'detail')}
            options={[
              { value: 'simple', label: '簡易表示' },
              { value: 'detail', label: '詳細表示' },
            ]}
          />
        </Flex>

        <Table<MenuRow>
          rowKey="id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            defaultPageSize: 20,
            showTotal: (total) => `全 ${total} 件`,
          }}
          columns={[
            {
              title: '商品名',
              dataIndex: 'name',
              width: 220,
              fixed: 'left',
              render: (value: string, row) => (
                <Space size={4}>
                  {value}
                  {row.is_notice_only && <Tag>案内</Tag>}
                  {row.is_free_key && <Tag color="purple">フリーキー</Tag>}
                </Space>
              ),
            },
            {
              title: 'カテゴリ',
              key: 'categories',
              width: 200,
              render: (_, row) => (
                <Space size={4} wrap>
                  {row.category_names.map((name) => (
                    <Tag key={name}>{name}</Tag>
                  ))}
                  {row.category_names.length === 0 && (
                    <span style={{ color: '#bfbfbf' }}>未設定</span>
                  )}
                </Space>
              ),
            },
            {
              title: '価格',
              dataIndex: 'price',
              width: 130,
              align: 'right',
              render: (value: number, row) => (
                <span className="tabular">
                  {yen.format(value)}円
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                    ({row.tax_method === 'incl' ? '税込' : '税抜'})
                  </span>
                </span>
              ),
            },
            {
              title: 'オプション',
              key: 'options',
              width: 200,
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
              title: 'タイプ',
              dataIndex: 'menu_type',
              width: 100,
              render: (value: MenuTypeValue) => (
                <Tag color={MENU_TYPE_COLOR[value]}>{MENU_TYPE_LABEL[value]}</Tag>
              ),
            },
            {
              title: '取扱店舗',
              dataIndex: 'dealing_shop_count',
              width: 100,
              align: 'right',
              render: (value: number) => <span className="tabular">{value} 店舗</span>,
            },
            ...(detail
              ? [
                  { title: '伝票表示名', dataIndex: 'receipt_display_name', width: 160 },
                  {
                    title: '税率',
                    dataIndex: 'tax_rate',
                    width: 90,
                    align: 'right' as const,
                    render: (value: number, row: MenuRow) => (
                      <Space size={4}>
                        <span className="tabular">{(value * 100).toFixed(0)}%</span>
                        {row.reduced_rate_eligible && (
                          <Tag color="cyan" style={{ marginInlineEnd: 0 }}>
                            持帰8%
                          </Tag>
                        )}
                      </Space>
                    ),
                  },
                  {
                    title: '原価',
                    dataIndex: 'cost_price',
                    width: 100,
                    align: 'right' as const,
                    render: (value: number | null) =>
                      value === null ? (
                        <span style={{ color: '#bfbfbf' }}>—</span>
                      ) : (
                        <span className="tabular">{yen.format(value)}円</span>
                      ),
                  },
                  {
                    title: '店外',
                    dataIndex: 'is_takeout',
                    width: 80,
                    render: (value: boolean) => (value ? <Tag color="geekblue">店外</Tag> : null),
                  },
                ]
              : []),
          ]}
        />
      </Card>
    </>
  );
}
