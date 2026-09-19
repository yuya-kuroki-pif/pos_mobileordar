'use client';

import { CopyOutlined } from '@ant-design/icons';
import { App, Button, Card, Empty, Flex, Input, Select, Space, Switch, Table, Tag } from 'antd';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { updateShopMenuAction } from '@/lib/actions/menu';
import { canEdit, type PermissionMap } from '@/lib/permissions';
import type { ShopMenuBoard } from '@/lib/shopMenuQueries';
import type { Shop, ShopMenu, ShopMenuRow } from '@/lib/types';

import { CopyShopMenuModal } from './CopyShopMenuModal';
import { StockCell } from './StockCell';

type TriState = 'all' | 'on' | 'off';

const TRI_OPTIONS = [
  { value: 'all', label: '指定なし' },
  { value: 'on', label: 'ON' },
  { value: 'off', label: 'OFF' },
];

/**
 * 取扱メニュー一覧（仕様書 §5.13）。
 * Switch は切り替えるたびにその行だけ即時保存する。
 */
export function ShopMenuView({
  shops,
  shopId,
  board,
  companyName,
  permissions,
}: {
  shops: Shop[];
  shopId?: string;
  board?: ShopMenuBoard;
  companyName: string;
  permissions: PermissionMap;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState<ShopMenuRow[]>(board?.rows ?? []);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [, startTransition] = useTransition();

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [customer, setCustomer] = useState<TriState>('all');
  const [staff, setStaff] = useState<TriState>('all');
  const [stock, setStock] = useState<TriState>('all');
  const [printerId, setPrinterId] = useState<string | undefined>();
  const [groupId, setGroupId] = useState<string | undefined>();

  const editable = canEdit(permissions, 'shop_management');

  const categories = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.category_names))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    const match = (state: TriState, value: boolean) =>
      state === 'all' || (state === 'on') === value;

    return rows.filter((row) => {
      if (needle && !row.menu_name.toLowerCase().includes(needle)) return false;
      if (category && !row.category_names.includes(category)) return false;
      if (!match(customer, row.is_visible_customer)) return false;
      if (!match(staff, row.is_visible_staff)) return false;
      if (!match(stock, row.in_stock)) return false;
      if (printerId && row.kitchen_printer_id !== printerId) return false;
      if (groupId && row.dish_up_slip_group_id !== groupId) return false;
      return true;
    });
  }, [rows, keyword, category, customer, staff, stock, printerId, groupId]);

  function clearFilters() {
    setKeyword('');
    setCategory(undefined);
    setCustomer('all');
    setStaff('all');
    setStock('all');
    setPrinterId(undefined);
    setGroupId(undefined);
  }

  function patch(menuId: string, change: Partial<ShopMenu>) {
    if (!shopId) return;

    // 先に画面へ反映し、失敗したら戻す
    const before = rows;
    setRows((current) =>
      current.map((row) => (row.menu_id === menuId ? { ...row, ...change } : row))
    );
    setSavingId(menuId);

    startTransition(async () => {
      const result = await updateShopMenuAction(shopId, menuId, change);
      setSavingId(null);
      if (!result.ok) {
        setRows(before);
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      router.refresh();
    });
  }

  if (shops.length === 0 || !shopId || !board) {
    return (
      <>
        <PageHeader
          title="取扱メニュー一覧"
          breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: '取扱メニュー一覧' }]}
        />
        <Card>
          <Empty description="この業態には店舗がありません" />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="取扱メニュー一覧"
        description="店舗ごとに、メニューの公開・在庫・出力先を決めます"
        breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: '取扱メニュー一覧' }]}
        extra={
          <Space>
            <Select
              value={shopId}
              style={{ width: 240 }}
              onChange={(value) => router.push(`/shop/menu?shop=${value}`)}
              options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
            />
            <Button
              icon={<CopyOutlined />}
              disabled={!editable || shops.length < 2}
              onClick={() => setCopyOpen(true)}
            >
              他店舗の取扱一括設定
            </Button>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Flex gap={8} wrap style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Input.Search
            placeholder="メニュー名"
            allowClear
            value={keyword}
            style={{ width: 200 }}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            placeholder="カテゴリ名"
            allowClear
            value={category}
            style={{ width: 160 }}
            onChange={setCategory}
            options={categories.map((name) => ({ value: name, label: name }))}
          />
          <Select
            value={customer}
            style={{ width: 150 }}
            onChange={setCustomer}
            options={TRI_OPTIONS.map((o) => ({ ...o, label: `お客様表示: ${o.label}` }))}
          />
          <Select
            value={staff}
            style={{ width: 160 }}
            onChange={setStaff}
            options={TRI_OPTIONS.map((o) => ({ ...o, label: `スタッフ表示: ${o.label}` }))}
          />
          <Select
            value={stock}
            style={{ width: 130 }}
            onChange={setStock}
            options={TRI_OPTIONS.map((o) => ({ ...o, label: `在庫: ${o.label}` }))}
          />
          <Select
            placeholder="キッチンプリンター"
            allowClear
            value={printerId}
            style={{ width: 180 }}
            onChange={setPrinterId}
            options={board.printers.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            placeholder="デシャップグループ"
            allowClear
            value={groupId}
            style={{ width: 180 }}
            onChange={setGroupId}
            options={board.dishUpGroups.map((g) => ({ value: g.id, label: g.name }))}
          />
          <Button onClick={clearFilters}>クリア</Button>
        </Flex>

        <Table<ShopMenuRow>
          rowKey="menu_id"
          dataSource={filtered}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} 品` }}
          columns={[
            {
              title: 'メニュー名',
              dataIndex: 'menu_name',
              width: 220,
              fixed: 'left',
              render: (value: string, row) => (
                <Space size={4}>
                  {value}
                  {!row.is_dealing && <Tag>取扱なし</Tag>}
                </Space>
              ),
            },
            {
              title: 'カテゴリ名',
              key: 'categories',
              width: 180,
              render: (_, row) => (
                <Space size={4} wrap>
                  {row.category_names.map((name) => (
                    <Tag key={name}>{name}</Tag>
                  ))}
                  {row.category_names.length === 0 && (
                    <span style={{ color: '#bfbfbf' }}>—</span>
                  )}
                </Space>
              ),
            },
            {
              title: '取扱',
              dataIndex: 'is_dealing',
              width: 80,
              render: (value: boolean, row) => (
                <Switch
                  checked={value}
                  disabled={!editable}
                  loading={savingId === row.menu_id}
                  onChange={(checked) => patch(row.menu_id, { is_dealing: checked })}
                />
              ),
            },
            {
              title: '公開（お客様）',
              dataIndex: 'is_visible_customer',
              width: 130,
              render: (value: boolean, row) => (
                <Switch
                  checked={value}
                  disabled={!editable || !row.is_dealing}
                  onChange={(checked) => patch(row.menu_id, { is_visible_customer: checked })}
                />
              ),
            },
            {
              title: '公開（スタッフ）',
              dataIndex: 'is_visible_staff',
              width: 140,
              render: (value: boolean, row) => (
                <Switch
                  checked={value}
                  disabled={!editable || !row.is_dealing}
                  onChange={(checked) => patch(row.menu_id, { is_visible_staff: checked })}
                />
              ),
            },
            {
              title: '在庫',
              dataIndex: 'in_stock',
              width: 80,
              render: (value: boolean, row) => (
                <Switch
                  checked={value}
                  disabled={!editable || !row.is_dealing}
                  onChange={(checked) => patch(row.menu_id, { in_stock: checked })}
                />
              ),
            },
            {
              title: '在庫数',
              key: 'stock',
              width: 220,
              render: (_, row) => (
                <StockCell
                  row={row}
                  editable={editable && row.is_dealing}
                  onSave={(change) => patch(row.menu_id, change)}
                />
              ),
            },
            {
              title: 'キッチンプリンター',
              dataIndex: 'kitchen_printer_id',
              width: 180,
              render: (value: string | null, row) => (
                <Select
                  size="small"
                  allowClear
                  placeholder="未設定"
                  value={value ?? undefined}
                  disabled={!editable || !row.is_dealing}
                  style={{ width: 160 }}
                  onChange={(next) =>
                    patch(row.menu_id, { kitchen_printer_id: next ?? null })
                  }
                  options={board.printers.map((p) => ({ value: p.id, label: p.name }))}
                />
              ),
            },
            {
              title: 'デシャップグループ',
              dataIndex: 'dish_up_slip_group_id',
              width: 180,
              render: (value: string | null, row) => (
                <Select
                  size="small"
                  allowClear
                  placeholder="未設定"
                  value={value ?? undefined}
                  disabled={!editable || !row.is_dealing}
                  style={{ width: 160 }}
                  onChange={(next) =>
                    patch(row.menu_id, { dish_up_slip_group_id: next ?? null })
                  }
                  options={board.dishUpGroups.map((g) => ({ value: g.id, label: g.name }))}
                />
              ),
            },
          ]}
        />
      </Card>

      <CopyShopMenuModal
        open={copyOpen}
        sourceShop={shops.find((s) => s.id === shopId)!}
        shops={shops}
        onClose={() => setCopyOpen(false)}
      />
    </>
  );
}
