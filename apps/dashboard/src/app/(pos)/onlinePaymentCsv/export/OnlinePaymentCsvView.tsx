'use client';

import { DownloadOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, DatePicker, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { exportOnlinePaymentCsvAction } from '@/lib/actions/onlinePaymentCsv';
import { downloadCsv } from '@/lib/downloadCsv';

/** モバイル決済取引 CSV（仕様書 §5.28） */
export function OnlinePaymentCsvView({
  companyName,
  shops,
}: {
  companyName: string;
  shops: { id: string; name: string }[];
}) {
  const { message } = App.useApp();
  const [shopIds, setShopIds] = useState<string[]>(shops.map((s) => s.id));
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await exportOnlinePaymentCsvAction(
        shopIds,
        range[0].format('YYYY-MM-DD'),
        range[1].format('YYYY-MM-DD')
      );
      if (!result.ok || !result.csv || !result.name) {
        message.error(result.error ?? 'CSV を作れませんでした');
        return;
      }
      if (result.count === 0) {
        message.warning('この期間の取引がありませんでした。見出しだけの CSV を保存します。');
      }
      downloadCsv(result.name, result.csv);
    });
  }

  return (
    <>
      <PageHeader
        title="モバイル決済取引CSV"
        description="決済端末を通した取引を CSV で書き出します"
        breadcrumb={[{ label: companyName }, { label: 'データ出力・連携' }, { label: 'モバイル決済取引CSV' }]}
      />

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Text strong>店舗</Typography.Text>
            <Select
              mode="multiple"
              value={shopIds}
              onChange={setShopIds}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="店舗を選んでください"
              options={shops.map((s) => ({ value: s.id, label: s.name }))}
              maxTagCount="responsive"
            />
          </div>

          <div>
            <Typography.Text strong>期間</Typography.Text>
            <br />
            <DatePicker.RangePicker
              value={range}
              onChange={(value) => {
                if (value && value[0] && value[1]) setRange([value[0], value[1]]);
              }}
              allowClear={false}
              style={{ marginTop: 8 }}
            />
          </div>

          <Alert
            type="info"
            showIcon
            message="出力ファイル: onlinePayment.csv"
            description="取引日時・取引ID・決済種別・売上・手数料・手数料差引後・ブランド・カード番号（マスク済み）などを含みます。"
          />

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={run}
            loading={pending}
            disabled={shopIds.length === 0}
          >
            ダウンロード
          </Button>
        </Space>
      </Card>
    </>
  );
}
