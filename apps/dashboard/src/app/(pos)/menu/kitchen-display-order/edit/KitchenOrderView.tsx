'use client';

import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, List, Select, Space, Tag, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { saveKitchenOrderAction } from '@/lib/actions/printing';
import type { KitchenOrderRow } from '@/lib/printingQueries';
import type { Shop } from '@/lib/types';

/**
 * キッチン表示・印刷順（仕様書 §5.16）。
 *
 * 指示書はドラッグでの並べ替えだが、ドラッグ用のライブラリを増やさずに済むよう
 * 上下ボタンで動かす形にしている。保存される並びは同じ。
 */
export function KitchenOrderView({
  rows,
  shops,
  shopId,
  companyName,
  editable,
}: {
  rows: KitchenOrderRow[];
  shops: Shop[];
  shopId?: string;
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [order, setOrder] = useState<KitchenOrderRow[]>(rows);
  const [pending, startTransition] = useTransition();

  function move(index: number, delta: number) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function save() {
    if (!shopId) return;
    startTransition(async () => {
      const result = await saveKitchenOrderAction(
        shopId,
        order.map((row) => row.category_id)
      );
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="キッチン表示・印刷順"
        description="キッチンディスプレイと伝票に出るカテゴリの並び順を決めます"
        breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: 'キッチン表示・印刷順' }]}
        extra={
          <Space>
            {shops.length > 0 && (
              <Select
                value={shopId}
                style={{ width: 220 }}
                onChange={(value) =>
                  router.push(`/menu/kitchen-display-order/edit?shop=${value}`)
                }
                options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
              />
            )}
            <Button type="primary" onClick={save} loading={pending} disabled={!editable}>
              更 新
            </Button>
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="この並びは、キッチンディスプレイと調理伝票の両方に効きます"
        description="お客様の画面（モバイルオーダー）の並びはカテゴリの表示順で決まります。ここでの変更は店舗の中だけの話です。"
      />

      <Card>
        <List
          dataSource={order}
          locale={{ emptyText: 'カテゴリがありません' }}
          renderItem={(row, index) => (
            <List.Item
              actions={[
                <Button
                  key="up"
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={!editable || index === 0}
                  onClick={() => move(index, -1)}
                />,
                <Button
                  key="down"
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={!editable || index === order.length - 1}
                  onClick={() => move(index, 1)}
                />,
              ]}
            >
              <Space>
                <Typography.Text type="secondary" style={{ width: 24, display: 'inline-block' }}>
                  {index + 1}
                </Typography.Text>
                <Typography.Text strong>{row.name}</Typography.Text>
                <Tag>{row.menu_count} 品</Tag>
              </Space>
            </List.Item>
          )}
        />
      </Card>
    </>
  );
}
