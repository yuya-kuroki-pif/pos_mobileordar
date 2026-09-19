'use client';

import { DownloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, DatePicker, Flex, Select, Space, Table, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ABC_COLORS } from '@/styles/theme';
import type { MenuSummary, ProductType, Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

const TYPE_LABEL: Record<ProductType, string> = {
  food: 'フード',
  drink: 'ドリンク',
  other: 'その他',
};

type Rank = 'A' | 'B' | 'C';

interface AbcRow extends MenuSummary {
  rank: Rank;
  qtyShare: number;
  salesShare: number;
  profitShare: number;
}

/**
 * 商品分析（仕様書 §6.5）。
 * ABC は出数の累積構成比で切る。70% までが A、90% までが B、残りが C。
 */
export function ProductAnalyticsView({
  menus,
  shops,
  shopId,
  yearMonth,
  companyName,
}: {
  menus: MenuSummary[];
  shops: Shop[];
  shopId?: string;
  yearMonth: string;
  companyName: string;
}) {
  const router = useRouter();
  const [granularity, setGranularity] = useState<'menu' | 'category' | 'type'>('menu');

  function go(next: { shop?: string; month?: string }) {
    const params = new URLSearchParams();
    const shopValue = next.shop ?? shopId;
    if (shopValue) params.set('shop', shopValue);
    params.set('month', next.month ?? yearMonth);
    router.push(`/bi/product-analytics?${params.toString()}`);
  }

  const rows = useMemo<AbcRow[]>(() => {
    // 粒度に応じてまとめ直す
    const grouped = new Map<string, MenuSummary>();

    for (const menu of menus) {
      const key =
        granularity === 'menu'
          ? (menu.menu_id ?? menu.name)
          : granularity === 'category'
            ? (menu.category_name ?? '未設定')
            : menu.menu_type;

      const current =
        grouped.get(key) ??
        ({
          ...menu,
          name:
            granularity === 'menu'
              ? menu.name
              : granularity === 'category'
                ? (menu.category_name ?? '未設定')
                : TYPE_LABEL[menu.menu_type],
          qty: 0,
          sales: 0,
          gross_profit: 0,
        } satisfies MenuSummary);

      current.qty += menu.qty;
      current.sales += menu.sales;
      current.gross_profit += menu.gross_profit;
      grouped.set(key, current);
    }

    const list = [...grouped.values()].sort((a, b) => b.qty - a.qty);
    const totalQty = list.reduce((sum, r) => sum + r.qty, 0);
    const totalSales = list.reduce((sum, r) => sum + r.sales, 0);
    const totalProfit = list.reduce((sum, r) => sum + r.gross_profit, 0);

    let cumulative = 0;
    return list.map((row) => {
      const qtyShare = totalQty > 0 ? row.qty / totalQty : 0;
      cumulative += qtyShare;
      const rank: Rank = cumulative <= 0.7 ? 'A' : cumulative <= 0.9 ? 'B' : 'C';

      return {
        ...row,
        rank,
        qtyShare,
        salesShare: totalSales > 0 ? row.sales / totalSales : 0,
        profitShare: totalProfit > 0 ? row.gross_profit / totalProfit : 0,
      };
    });
  }, [menus, granularity]);

  function downloadCsv() {
    const header = ['順位', '商品名', '単価', '出数', '出数構成比', '売上', '売上構成比', 'ランク'];
    const body = rows.map((row, index) =>
      [
        index + 1,
        row.name,
        row.unit_price,
        row.qty,
        (row.qtyShare * 100).toFixed(1),
        row.sales,
        (row.salesShare * 100).toFixed(1),
        row.rank,
      ].join(',')
    );

    const blob = new Blob(['\ufeff' + [header.join(','), ...body].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `product-${yearMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="商品分析"
        description="よく出ている商品と、そうでない商品を並べます"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '商品分析' }]}
        extra={
          <Button icon={<DownloadOutlined />} onClick={downloadCsv}>
            CSV
          </Button>
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="ABC 分析の見方"
        description={
          <Space size={8} wrap>
            <span>出数の多い順に並べ、累積構成比で 3 つに分けています。</span>
            <Tag color="magenta">A: 上位 70% まで＝主力</Tag>
            <Tag color="green">B: 90% まで＝準主力</Tag>
            <Tag>C: それ以外＝見直し候補</Tag>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Flex gap={8} wrap style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Select
            placeholder="全店舗"
            allowClear
            value={shopId}
            style={{ width: 220 }}
            onChange={(value) => go({ shop: value ?? '' })}
            options={shops.map((s) => ({ value: s.id, label: s.name }))}
          />
          <DatePicker
            picker="month"
            value={dayjs(yearMonth)}
            allowClear={false}
            onChange={(value) => go({ month: value.format('YYYY-MM') })}
          />
        </Flex>

        <Tabs
          activeKey={granularity}
          onChange={(key) => setGranularity(key as typeof granularity)}
          style={{ padding: '0 16px' }}
          items={[
            { key: 'menu', label: '商品別' },
            { key: 'category', label: 'カテゴリ別' },
            { key: 'type', label: 'メニュータイプ別' },
          ]}
        />

        <Table<AbcRow>
          rowKey={(row) => `${row.rank}-${row.name}`}
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} 件` }}
          columns={[
            {
              title: '順位',
              key: 'rank',
              width: 70,
              fixed: 'left',
              render: (_, __, index) => <span className="tabular">{index + 1}</span>,
            },
            { title: '商品名', dataIndex: 'name', width: 220, fixed: 'left' },
            {
              title: 'ランク',
              dataIndex: 'rank',
              width: 90,
              render: (value: Rank) => (
                <span
                  style={{
                    background: ABC_COLORS[value].bg,
                    color: ABC_COLORS[value].text,
                    padding: '2px 10px',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  {value}
                </span>
              ),
            },
            {
              title: '単価',
              dataIndex: 'unit_price',
              width: 110,
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
            {
              title: '出数構成比',
              key: 'qtyShare',
              width: 170,
              render: (_, row) => (
                <Space size={6}>
                  <span className="tabular">{(row.qtyShare * 100).toFixed(1)}%</span>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>{row.qty} 点</span>
                </Space>
              ),
            },
            {
              title: '売上構成比',
              key: 'salesShare',
              width: 200,
              render: (_, row) => (
                <Space size={6}>
                  <span className="tabular">{(row.salesShare * 100).toFixed(1)}%</span>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>¥{yen.format(row.sales)}</span>
                </Space>
              ),
            },
            {
              title: '粗利構成比',
              key: 'profitShare',
              width: 200,
              render: (_, row) => (
                <Space size={6}>
                  <span className="tabular">{(row.profitShare * 100).toFixed(1)}%</span>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                    ¥{yen.format(row.gross_profit)}
                  </span>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
