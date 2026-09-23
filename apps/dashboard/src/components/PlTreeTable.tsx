'use client';

import { DownloadOutlined } from '@ant-design/icons';
import { Button, Card, Space, Table, Typography } from 'antd';
import { useState } from 'react';

import { downloadCsv, toCsv } from '@/lib/downloadCsv';

const yen = new Intl.NumberFormat('ja-JP');

export interface PlTableNode {
  key: string;
  label: string;
  values: Record<string, number>;
  children?: PlTableNode[];
  emphasis?: boolean;
}

/**
 * 損益計算書のツリー表（仕様書 §6.2）。
 * 行は PL区分 > 科目 > 補助科目、列は呼び出し側が渡す（店舗 / 月 / 日）。
 */
export function PlTreeTable({
  title,
  nodes,
  columns,
  csvName,
}: {
  title: string;
  nodes: PlTableNode[];
  columns: { key: string; label: string }[];
  csvName: string;
}) {
  // 既定はすべて折りたたむ。まず区分の合計だけを見せたい
  const [expanded, setExpanded] = useState<readonly string[]>([]);
  const allKeys = collectKeys(nodes);

  function exportCsv() {
    const rows: (string | number)[][] = [];
    const walk = (list: PlTableNode[], depth: number) => {
      for (const node of list) {
        rows.push([
          '　'.repeat(depth) + node.label,
          ...columns.map((column) => node.values[column.key] ?? 0),
        ]);
        if (node.children) walk(node.children, depth + 1);
      }
    };
    walk(nodes, 0);
    downloadCsv(csvName, toCsv(['項目', ...columns.map((c) => c.label)], rows));
  }

  return (
    <Card
      title={title}
      styles={{ body: { padding: 0 } }}
      extra={
        <Space>
          <Button
            size="small"
            onClick={() => setExpanded(expanded.length === 0 ? allKeys : [])}
          >
            {expanded.length === 0 ? 'すべて展開' : 'すべて折りたたむ'}
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={exportCsv}>
            CSV
          </Button>
        </Space>
      }
    >
      <Table<PlTableNode>
        rowKey="key"
        dataSource={nodes}
        size="middle"
        pagination={false}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowKeys: expanded,
          onExpandedRowsChange: (keys) => setExpanded(keys.map(String)),
        }}
        columns={[
          {
            title: '項目',
            dataIndex: 'label',
            width: 260,
            fixed: 'left',
            render: (label: string, row) =>
              row.emphasis ? <Typography.Text strong>{label}</Typography.Text> : label,
          },
          ...columns.map((column) => ({
            title: column.label,
            key: column.key,
            width: 150,
            align: 'right' as const,
            render: (_: unknown, row: PlTableNode) => {
              const value = row.values[column.key] ?? 0;
              return (
                <span
                  className="tabular"
                  style={{
                    fontWeight: row.emphasis ? 600 : undefined,
                    color: value < 0 ? '#f5222d' : undefined,
                  }}
                >
                  ¥{yen.format(value)}
                </span>
              );
            },
          })),
        ]}
      />
    </Card>
  );
}

function collectKeys(nodes: PlTableNode[]): string[] {
  return nodes.flatMap((node) =>
    node.children ? [node.key, ...collectKeys(node.children)] : []
  );
}
