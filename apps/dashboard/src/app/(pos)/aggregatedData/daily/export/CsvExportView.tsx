'use client';

import { DownloadOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Checkbox, DatePicker, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { exportCsvAction } from '@/lib/actions/exportCsv';
import { EXPORT_LABELS, type ExportKind } from '@/lib/exportDefs';
import type { Shop } from '@/lib/types';

/** CSV ダウンロード（仕様書 §5.28） */
export function CsvExportView({ shops, companyName }: { shops: Shop[]; companyName: string }) {
  const { message } = App.useApp();
  const [shopIds, setShopIds] = useState<string[]>(shops.map((s) => s.id));
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);
  const [kinds, setKinds] = useState<ExportKind[]>(['summaryByShops']);
  const [pending, startTransition] = useTransition();

  function save(name: string, csv: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function run() {
    if (range[1].diff(range[0], 'day') > 31) {
      message.warning('期間は最大 1 ヶ月までにしてください。');
      return;
    }

    startTransition(async () => {
      const result = await exportCsvAction(
        shopIds,
        range[0].format('YYYY-MM-DD'),
        range[1].format('YYYY-MM-DD'),
        kinds
      );
      if (!result.ok || !result.files) {
        message.error(result.error ?? '出力できませんでした');
        return;
      }

      for (const file of result.files) save(file.name, file.csv);
      message.success(`${result.files.length} 件のファイルを出力しました`);
    });
  }

  return (
    <>
      <PageHeader
        title="CSVダウンロード"
        description="期間と店舗を選んで、集計結果を CSV で落とせます"
        breadcrumb={[{ label: companyName }, { label: 'データ出力・連携' }, { label: 'CSVダウンロード' }]}
      />

      <Card title="店舗選択" style={{ marginBottom: 16 }}>
        <Checkbox
          indeterminate={shopIds.length > 0 && shopIds.length < shops.length}
          checked={shopIds.length === shops.length && shops.length > 0}
          onChange={(e) => setShopIds(e.target.checked ? shops.map((s) => s.id) : [])}
        >
          全選択
        </Checkbox>
        <div style={{ marginTop: 8 }}>
          <Checkbox.Group
            value={shopIds}
            options={shops.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(values) => setShopIds(values as string[])}
          />
        </div>
      </Card>

      <Card title="期間" style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker
          value={range}
          allowClear={false}
          onChange={(value) => {
            if (value?.[0] && value?.[1]) setRange([value[0], value[1]]);
          }}
        />
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          最大 1 ヶ月まで選べます。
        </Typography.Paragraph>
      </Card>

      <Card title="出力ファイル">
        <Checkbox.Group
          value={kinds}
          onChange={(values) => setKinds(values as ExportKind[])}
        >
          <Space direction="vertical">
            {(Object.keys(EXPORT_LABELS) as ExportKind[]).map((kind) => (
              <Checkbox key={kind} value={kind}>
                {EXPORT_LABELS[kind]}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </Card>

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 16 }}
        message="件数が多いと出力に時間がかかります"
        description="いまはその場で組み立てて返しています。待たされるようになったら、裏で作って出来たら知らせる形に変えます。"
      />

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={pending}
          disabled={shopIds.length === 0 || kinds.length === 0}
          onClick={run}
        >
          ダウンロード
        </Button>
      </div>
    </>
  );
}
