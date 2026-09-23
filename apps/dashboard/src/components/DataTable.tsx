'use client';

import { Card, Rate, Space, Table, Tag, Typography } from 'antd';

import { useT } from './LocaleProvider';

const yen = new Intl.NumberFormat('ja-JP');

/**
 * サーバーコンポーネントから使える表。
 *
 * antd の Table は列に render 関数を渡すが、関数はサーバーから
 * クライアントへ渡せない。そこで「どう見せるか」を値で書けるようにして、
 * 実際の描画はこの中で行う。
 */
export type CellFormat =
  | { type: 'text' }
  | { type: 'number' }
  | { type: 'money' }
  | { type: 'percent'; digits?: number }
  | { type: 'rate' }
  | { type: 'tag'; color?: string }
  | { type: 'tags' }
  | { type: 'rank' }
  | { type: 'index' }
  | { type: 'scoreTag' }
  /** 増減。プラスは緑、マイナスは赤で符号つきに出す */
  | { type: 'delta'; digits?: number; unit?: string }
  /** 数値のうしろに単位をつける */
  | { type: 'unit'; unit: string; digits?: number };

export interface DataColumn {
  title: string;
  key: string;
  width?: number;
  align?: 'left' | 'right';
  fixed?: 'left' | 'right';
  format?: CellFormat;
}

export type DataRow = Record<string, unknown> & { key: string };

/** 100 点換算のスコアからランク記号と色を出す（仕様書 §5.32） */
function scoreRank(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'S', color: 'magenta' };
  if (score >= 80) return { label: 'A', color: 'green' };
  if (score >= 70) return { label: 'B', color: 'blue' };
  if (score >= 60) return { label: 'C', color: 'orange' };
  return { label: 'D', color: 'red' };
}

function renderCell(value: unknown, format: CellFormat | undefined, index: number) {
  const kind = format?.type ?? 'text';

  if (kind === 'index') return <span className="tabular">{index + 1}</span>;

  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#bfbfbf' }}>—</span>;
  }

  switch (kind) {
    case 'number':
      return <span className="tabular">{yen.format(Number(value))}</span>;
    case 'money':
      return <span className="tabular">¥{yen.format(Number(value))}</span>;
    case 'percent':
      return (
        <span className="tabular">
          {Number(value).toFixed(format && 'digits' in format ? (format.digits ?? 1) : 1)}%
        </span>
      );
    case 'rate':
      return (
        <Space size={6}>
          <Rate
            disabled
            allowHalf
            value={Math.round(Number(value) * 2) / 2}
            style={{ fontSize: 14 }}
          />
          <span className="tabular">{Number(value).toFixed(1)}</span>
        </Space>
      );
    case 'tag':
      return <Tag color={format && 'color' in format ? format.color : undefined}>{String(value)}</Tag>;
    case 'tags':
      return (
        <Space size={4} wrap>
          {(value as string[]).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      );
    case 'delta': {
      const number = Number(value);
      const digits = format && 'digits' in format ? (format.digits ?? 1) : 1;
      const unit = format && 'unit' in format ? (format.unit ?? '') : '';

      if (number === 0) return <span style={{ color: '#bfbfbf' }}>±0{unit}</span>;
      return (
        <span className="tabular" style={{ color: number > 0 ? '#389e0d' : '#cf1322' }}>
          {number > 0 ? '+' : '−'}
          {Math.abs(number).toFixed(digits)}
          {unit}
        </span>
      );
    }
    case 'unit': {
      const digits = format && 'digits' in format ? format.digits : undefined;
      const number = Number(value);
      return (
        <span className="tabular">
          {digits === undefined ? yen.format(number) : number.toFixed(digits)}
          <span style={{ color: '#8c8c8c', marginLeft: 2 }}>
            {format && 'unit' in format ? format.unit : ''}
          </span>
        </span>
      );
    }
    case 'scoreTag': {
      const rank = scoreRank(Number(value));
      return (
        <Tag color={rank.color} className="tabular">
          {rank.label} {Number(value)}
        </Tag>
      );
    }
    default:
      return String(value);
  }
}

export function DataTable({
  columns,
  rows,
  title,
  extra,
  emptyText = 'データがありません',
  pageSize,
  style,
}: {
  columns: DataColumn[];
  rows: DataRow[];
  title?: string;
  extra?: React.ReactNode;
  emptyText?: string;
  pageSize?: number;
  style?: React.CSSProperties;
}) {
  const t = useT();

  const table = (
    <Table<DataRow>
      rowKey="key"
      dataSource={rows}
      size="middle"
      scroll={{ x: 'max-content' }}
      pagination={
        pageSize
          ? { pageSize, showSizeChanger: false, showTotal: (t) => `${t} 件` }
          : false
      }
      locale={{ emptyText: t(emptyText) }}
      columns={columns.map((column) => ({
        title: t(column.title),
        dataIndex: column.key,
        width: column.width,
        align: column.align,
        fixed: column.fixed,
        render: (value: unknown, _row: DataRow, index: number) =>
          renderCell(value, column.format, index),
      }))}
    />
  );

  if (!title && !extra) return <div style={style}>{table}</div>;

  return (
    <Card title={title ? t(title) : undefined} extra={extra} styles={{ body: { padding: 0 } }} style={style}>
      {table}
    </Card>
  );
}

/** 表の下などに置く小さな注記 */
export function TableNote({ children }: { children: React.ReactNode }) {
  return (
    <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
      {children}
    </Typography.Paragraph>
  );
}
