'use client';

import { ThunderboltOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Row,
  Select,
  Slider,
  Space,
  Statistic,
  Table,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { saveDailyTargetsAction, saveKpiTargetAction } from '@/lib/actions/target';
import { suggestKpiTargetAction } from '@/lib/actions/targetAi';
import type { DailySalesTarget, KpiTarget, Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/** 目標設定（仕様書 §6.7） */
export function KpiTargetView({
  shops,
  shopId,
  yearMonth,
  target,
  dailyTargets,
  lastMonthSales,
  companyName,
  editable,
  aiReady,
}: {
  shops: Shop[];
  shopId?: string;
  yearMonth: string;
  target: KpiTarget | null;
  dailyTargets: DailySalesTarget[];
  lastMonthSales: number;
  companyName: string;
  editable: boolean;
  aiReady: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [adjust, setAdjust] = useState(0);
  const [pending, startTransition] = useTransition();

  const daysInMonth = dayjs(yearMonth).daysInMonth();
  const suggestion = Math.round(lastMonthSales * (1 + adjust / 100));
  const dailyTotal = dailyTargets.reduce((sum, t) => sum + t.amount, 0);

  function suggest() {
    if (!shopId) return;
    setSuggesting(true);
    setSuggestionNote(null);
    startTransition(async () => {
      const result = await suggestKpiTargetAction(shopId, yearMonth);
      setSuggesting(false);
      if (!result.ok || !result.suggestion) {
        message.error(result.error ?? '目安を出せませんでした');
        return;
      }
      // 保存はしない。人が確かめてから保存を押す
      const { reason, ...values } = result.suggestion;
      form.setFieldsValue(values);
      setSuggestionNote(reason);
    });
  }

  function go(next: { shop?: string; month?: string }) {
    const params = new URLSearchParams();
    params.set('shop', next.shop ?? shopId ?? '');
    params.set('month', next.month ?? yearMonth);
    router.push(`/bi/kpiTarget?${params.toString()}`);
  }

  function save() {
    if (!shopId) return;
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveKpiTargetAction(shopId, yearMonth, {
          sales_target: values.sales_target ?? 0,
          food_cost_target: values.food_cost_target ?? 0,
          drink_cost_target: values.drink_cost_target ?? 0,
          labor_target: values.labor_target ?? 0,
          sga_target: values.sga_target ?? 0,
          guest_target: values.guest_target ?? 0,
          avg_spend_target: values.avg_spend_target ?? 0,
        });
        if (!result.ok) {
          message.error(result.error ?? '保存できませんでした');
          return;
        }
        message.success('保存しました');
        router.refresh();
      });
    });
  }

  /** 月間目標を日数で均等に割って、日別目標にする */
  function spread() {
    if (!shopId) return;
    const monthly = form.getFieldValue('sales_target') ?? 0;
    const perDay = Math.round(monthly / daysInMonth);

    startTransition(async () => {
      const result = await saveDailyTargetsAction(
        shopId,
        Array.from({ length: daysInMonth }).map((_, i) => ({
          business_date: `${yearMonth}-${String(i + 1).padStart(2, '0')}`,
          amount: perDay,
        }))
      );
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('月間目標を日別に割り振りました');
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="目標設定"
        description="月間の目標を決めて、日別に割り振ります"
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '目標設定' }]}
        extra={
          <Space>
            <Select
              value={shopId}
              style={{ width: 220 }}
              onChange={(value) => go({ shop: value })}
              options={shops.map((s) => ({ value: s.id, label: s.name }))}
            />
            <DatePicker
              picker="month"
              value={dayjs(yearMonth)}
              allowClear={false}
              onChange={(value) => go({ month: value.format('YYYY-MM') })}
            />
            <Button
              icon={<ThunderboltOutlined />}
              onClick={suggest}
              loading={suggesting}
              disabled={!editable || !aiReady || !shopId}
            >
              AIで一括入力
            </Button>
          </Space>
        }
      />

      {!aiReady && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="「AIで一括入力」を使うには設定が要ります"
          description="ANTHROPIC_API_KEY を .env.local に設定すると、過去 6 ヶ月の実績から目標の目安を入れられます。"
        />
      )}

      {suggestionNote && (
        <Alert
          type="success"
          showIcon
          closable
          onClose={() => setSuggestionNote(null)}
          style={{ marginBottom: 16 }}
          message="AI が出した目安をフォームに入れました"
          description={`${suggestionNote} 保存を押すまでは反映されません。数字を確かめてから保存してください。`}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card title="前月の実績から決める" style={{ marginBottom: 16 }}>
            <Statistic title="前月の売上" value={lastMonthSales} prefix="¥" />

            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
              前月に対する増減を決めると、目標の目安が出ます。
            </Typography.Paragraph>
            <Slider
              min={-30}
              max={50}
              value={adjust}
              disabled={!editable}
              marks={{ '-30': '-30%', 0: '±0', 50: '+50%' }}
              onChange={setAdjust}
            />

            <Statistic title="目安" value={suggestion} prefix="¥" style={{ marginTop: 8 }} />
            <Button
              style={{ marginTop: 12 }}
              disabled={!editable || lastMonthSales === 0}
              onClick={() => form.setFieldValue('sales_target', suggestion)}
            >
              この金額を目標に入れる
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="月間目標（税抜）">
            <Form
              form={form}
              layout="vertical"
              disabled={!editable}
              initialValues={{
                sales_target: target?.sales_target ?? 0,
                food_cost_target: target?.food_cost_target ?? 0,
                drink_cost_target: target?.drink_cost_target ?? 0,
                labor_target: target?.labor_target ?? 0,
                sga_target: target?.sga_target ?? 0,
                guest_target: target?.guest_target ?? 0,
                avg_spend_target: target?.avg_spend_target ?? 0,
              }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="sales_target" label="売上">
                    <InputNumber prefix="¥" min={0} step={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item name="guest_target" label="客数">
                    <InputNumber min={0} suffix="人" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item name="avg_spend_target" label="客単価">
                    <InputNumber prefix="¥" min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={12} sm={6}>
                  <Form.Item name="food_cost_target" label="原価（フード）">
                    <InputNumber prefix="¥" min={0} step={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item name="drink_cost_target" label="原価（ドリンク）">
                    <InputNumber prefix="¥" min={0} step={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item name="labor_target" label="人件費">
                    <InputNumber prefix="¥" min={0} step={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item name="sga_target" label="販売管理費">
                    <InputNumber prefix="¥" min={0} step={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ textAlign: 'right' }}>
                <Space>
                  <Button onClick={spread} loading={pending} disabled={!editable}>
                    月間目標を日別に割り振る
                  </Button>
                  <Button type="primary" onClick={save} loading={pending} disabled={!editable}>
                    保 存
                  </Button>
                </Space>
              </div>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card
        title="日別売上目標"
        style={{ marginTop: 16 }}
        styles={{ body: { padding: 0 } }}
        extra={<span className="tabular">合計 ¥{yen.format(dailyTotal)}</span>}
      >
        <Table<DailySalesTarget>
          rowKey="business_date"
          dataSource={dailyTargets}
          size="small"
          pagination={false}
          locale={{ emptyText: 'まだ割り振っていません' }}
          columns={[
            {
              title: '日付',
              dataIndex: 'business_date',
              render: (value: string) => dayjs(value).format('MM/DD（dd）'),
            },
            {
              title: '目標',
              dataIndex: 'amount',
              align: 'right',
              render: (value: number) => <span className="tabular">¥{yen.format(value)}</span>,
            },
          ]}
        />
      </Card>
    </>
  );
}
