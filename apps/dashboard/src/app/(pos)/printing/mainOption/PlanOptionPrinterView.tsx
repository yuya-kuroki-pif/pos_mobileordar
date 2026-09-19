'use client';

import { App, Card, Select, Space, Table } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { setPlanOptionPrinterAction } from '@/lib/actions/printing';
import type { PlanOptionPrinterRow, PrintingBoard } from '@/lib/printingQueries';
import type { Shop } from '@/lib/types';

/** プランオプション印刷設定（仕様書 §5.16）。切り替えるたびに即時保存する */
export function PlanOptionPrinterView({
  board,
  shops,
  shopId,
  companyName,
  editable,
}: {
  board: PrintingBoard;
  shops: Shop[];
  shopId?: string;
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [rows, setRows] = useState(board.rows);
  const [, startTransition] = useTransition();

  function patch(planOptionId: string, printerId: string | null) {
    if (!shopId) return;

    const before = rows;
    setRows((current) =>
      current.map((row) =>
        row.plan_option_id === planOptionId ? { ...row, kitchen_printer_id: printerId } : row
      )
    );

    startTransition(async () => {
      const result = await setPlanOptionPrinterAction(shopId, planOptionId, printerId);
      if (!result.ok) {
        setRows(before);
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="プランオプション印刷設定"
        description="飲み放題などのプランオプションを、どのキッチンプリンターへ出すか決めます"
        breadcrumb={[
          { label: companyName },
          { label: '店舗管理' },
          { label: 'プランオプション印刷設定' },
        ]}
        extra={
          shops.length > 0 && (
            <Select
              value={shopId}
              style={{ width: 240 }}
              onChange={(value) => router.push(`/printing/mainOption?shop=${value}`)}
              options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
            />
          )
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table<PlanOptionPrinterRow>
          rowKey="plan_option_id"
          dataSource={rows}
          size="middle"
          pagination={false}
          locale={{ emptyText: 'プランオプションがありません' }}
          columns={[
            {
              title: 'カテゴリ名',
              dataIndex: 'category_name',
              width: 160,
              render: (value: string | null) =>
                value ?? <span style={{ color: '#bfbfbf' }}>未設定</span>,
            },
            { title: 'プラン', dataIndex: 'plan_name', width: 220 },
            { title: 'プランオプション名', dataIndex: 'option_name' },
            {
              title: 'キッチンプリンター',
              dataIndex: 'kitchen_printer_id',
              width: 220,
              render: (value: string | null, row) => (
                <Space>
                  <Select
                    allowClear
                    size="small"
                    placeholder="未設定"
                    value={value ?? undefined}
                    disabled={!editable}
                    style={{ width: 180 }}
                    onChange={(next) => patch(row.plan_option_id, next ?? null)}
                    options={board.printers.map((p) => ({ value: p.id, label: p.name }))}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
