'use client';

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Switch,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { savePlanAction, type PlanFormInput } from '@/lib/actions/plan';
import type { CategoryRow, PlanDetail, PlanGroup } from '@/lib/types';

/**
 * 基本情報タブ（仕様書 §5.4）。
 * プランの価格はここではなくオプションの選択肢が持つ（例: 人数 × 2,500 円）ので、
 * このフォームには販売価格の欄がない。
 */
export function PlanBasicForm({
  detail,
  categories,
  groups,
  editable,
}: {
  detail: PlanDetail | null;
  categories: CategoryRow[];
  groups: PlanGroup[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const plan = detail?.plan;

  // 制限時間 OFF のときは終了通知の欄ごと隠す
  const hasTimeLimit = Form.useWatch('has_time_limit', form) ?? plan?.has_time_limit ?? true;
  const hasEndNotice = Form.useWatch('has_end_notice', form) ?? plan?.has_end_notice ?? false;

  function submit() {
    setError(null);
    form
      .validateFields()
      .then((values) => {
        const input: PlanFormInput = {
          id: plan?.id ?? '',
          name: values.name,
          receipt_display_name: values.receipt_display_name ?? '',
          handy_display_name: values.handy_display_name ?? '',
          category_id: values.category_id ?? null,
          plan_group_id: values.plan_group_id ?? null,
          description: values.description ?? '',
          has_time_limit: values.has_time_limit ?? true,
          time_limit_min: values.time_limit_min ?? null,
          has_end_notice: values.has_end_notice ?? false,
          end_notice_min: values.end_notice_min ?? null,
          featured_label: values.featured_label ?? '',
          image_size: values.image_size,
          tax_method: values.tax_method,
          tax_rate: values.tax_rate,
          display_order: values.display_order ?? 0,
        };

        startTransition(async () => {
          const result = await savePlanAction(input);
          if (!result.ok || !result.id) {
            setError(result.error ?? '保存できませんでした');
            return;
          }
          message.success('保存しました');
          if (!plan) router.push(`/plan/${result.id}/option`);
          else router.refresh();
        });
      })
      .catch(() => {
        /* 入力エラーは Form が表示する */
      });
  }

  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!editable}
      initialValues={{
        name: plan?.name ?? '',
        receipt_display_name: plan?.receipt_display_name ?? '',
        handy_display_name: plan?.handy_display_name ?? '',
        category_id: plan?.category_id ?? undefined,
        plan_group_id: plan?.plan_group_id ?? undefined,
        description: plan?.description ?? '',
        has_time_limit: plan?.has_time_limit ?? true,
        time_limit_min: plan?.time_limit_min ?? 120,
        has_end_notice: plan?.has_end_notice ?? false,
        end_notice_min: plan?.end_notice_min ?? 30,
        featured_label: plan?.featured_label ?? '',
        image_size: plan?.image_size ?? 'medium',
        tax_method: plan?.tax_method ?? 'incl',
        tax_rate: plan?.tax_rate ?? 0.1,
        display_order: plan?.display_order ?? 0,
      }}
    >
      <Card title="プラン情報" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="プラン名"
          rules={[{ required: true, message: 'プラン名を入力してください' }]}
        >
          <Input placeholder="例: 2時間飲み放題" />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="receipt_display_name"
              label="伝票表示名"
              extra="空欄ならプラン名を使います"
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="handy_display_name" label="ハンディ表示名">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="category_id"
              label="カテゴリ"
              extra="モバイルオーダーでこのプランを出すカテゴリ"
            >
              <Select
                allowClear
                placeholder="未設定"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="plan_group_id"
              label="プラングループ"
              extra="一覧の絞り込みに使う任意のまとまり"
            >
              <Select
                allowClear
                placeholder="未設定"
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="プラン説明文（日本語）">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="featured_label" label="特集ラベル（日本語）" extra="例: 人気No.1">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="display_order" label="表示順" extra="小さいほど先頭">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="image_size" label="画像の表示サイズ">
          <Radio.Group
            optionType="button"
            options={[
              { value: 'large', label: '大サイズ' },
              { value: 'medium', label: '中サイズ' },
              { value: 'small', label: '小サイズ' },
              { value: 'hidden', label: '画像非表示' },
            ]}
          />
        </Form.Item>
      </Card>

      <Card title="制限時間" style={{ marginTop: 16 }}>
        <Form.Item
          name="has_time_limit"
          label="制限時間を設ける"
          valuePropName="checked"
          extra="OFF にすると時間無制限のプランになります"
        >
          <Switch />
        </Form.Item>

        {hasTimeLimit && (
          <>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="time_limit_min"
                  label="制限時間（分）"
                  rules={[{ required: true, message: '制限時間を入力してください' }]}
                >
                  <InputNumber min={1} step={30} suffix="分" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="has_end_notice"
              label="終了通知を出す"
              valuePropName="checked"
              extra="ハンディとモバイルオーダーに、終了が近いことを知らせます"
            >
              <Switch />
            </Form.Item>

            {hasEndNotice && (
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="end_notice_min" label="終了通知（終了の何分前）">
                    <InputNumber min={1} max={120} suffix="分前" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </>
        )}
      </Card>

      <Card title="税設定" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="tax_method" label="税種別">
              <Select
                options={[
                  { value: 'incl', label: '税込' },
                  { value: 'excl', label: '税抜' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="tax_rate" label="税率">
              <Select
                options={[
                  { value: 0.1, label: '10%' },
                  { value: 0.08, label: '8%' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          message="プランの価格はオプションで決めます"
          description="「人数 × 2,500 円」のように、価格はオプションの選択肢が持ちます。保存後にオプションタブで設定してください。"
        />
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#f5f5f5',
          padding: '16px 0',
          marginTop: 16,
          textAlign: 'right',
        }}
      >
        <Space>
          <Button onClick={() => router.push('/plan')}>キャンセル</Button>
          <Button type="primary" onClick={submit} loading={pending} disabled={!editable}>
            {plan ? '更 新' : '作 成'}
          </Button>
        </Space>
      </div>
    </Form>
  );
}
