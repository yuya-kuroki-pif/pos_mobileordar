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
  Space,
  Switch,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { TimeMinInput } from '@/components/TimeMinInput';
import { saveShopAction } from '@/lib/actions/shop';
import type { Shop } from '@/lib/types';

/** AI 機能のトグル。列名と説明文を 1 か所にまとめる */
const AI_TOGGLES: { key: keyof Shop; label: string; description: string }[] = [
  {
    key: 'ai_handy',
    label: 'AI ハンディ（音声入力）',
    description: 'ハンディに話しかけて注文を取れるようにします',
  },
  {
    key: 'ai_chat_diagnosis',
    label: 'AI チャット・店舗診断',
    description: '売上や客数の推移について、チャットで相談できます',
  },
  {
    key: 'ai_menu_book_diagnosis',
    label: 'AI メニューブック診断',
    description: 'メニュー構成や価格の偏りを指摘します',
  },
  {
    key: 'ai_mo_optimize',
    label: 'AI モバイルオーダー画面最適化',
    description: '注文実績をもとに、お客様に出す並び順を調整します',
  },
  {
    key: 'ai_daily_report',
    label: 'AI 日報（スタンダードプラン）',
    description: '営業終了後に、その日の要点をまとめます',
  },
  {
    key: 'ai_sales_forecast',
    label: '売上予測',
    description: '曜日・天候・予約状況から売上を見込みます',
  },
  {
    key: 'ai_slip_instruction',
    label: '伝票指示',
    description: '注文内容から、調理と提供の順番を伝票に添えます',
  },
];

/** 店舗編集 — 店舗タブ（仕様書 §5.12） */
export function ShopBasicForm({ shop, editable }: { shop: Shop; editable: boolean }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const orderLimit = Form.useWatch('order_limit_enabled', form) ?? shop.order_limit_enabled;
  const entryAlert = Form.useWatch('entry_alert_enabled', form) ?? shop.entry_alert_enabled;
  const lastOrderAlert =
    Form.useWatch('last_order_alert_enabled', form) ?? shop.last_order_alert_enabled;

  function submit() {
    setError(null);
    form
      .validateFields()
      .then((values) => {
        const patch: Partial<Shop> = {
          ...values,
          name_en: values.name_en?.trim() || null,
          last_order_label: values.last_order_label?.trim() || null,
          checkout_note: values.checkout_note?.trim() || null,
          order_limit_per_person: values.order_limit_enabled ? values.order_limit_per_person : null,
          entry_alert_min: values.entry_alert_enabled ? values.entry_alert_min : null,
          last_order_alert_min: values.last_order_alert_enabled
            ? values.last_order_alert_min
            : null,
        };

        startTransition(async () => {
          const result = await saveShopAction(shop.id, patch);
          if (!result.ok) {
            setError(result.error ?? '保存できませんでした');
            return;
          }
          message.success('保存しました');
          router.refresh();
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
        name_en: shop.name_en ?? '',
        last_order_label: shop.last_order_label ?? '',
        checkout_note: shop.checkout_note ?? '',
        open_time_min: shop.open_time_min,
        close_time_min: shop.close_time_min,
        order_limit_enabled: shop.order_limit_enabled,
        order_limit_per_person: shop.order_limit_per_person ?? 10,
        sold_out_daily_reset: shop.sold_out_daily_reset,
        note_input_enabled: shop.note_input_enabled,
        staff_call_enabled: shop.staff_call_enabled,
        auto_checkout_slip: shop.auto_checkout_slip,
        show_tax_excluded_price: shop.show_tax_excluded_price,
        checkout_guide: shop.checkout_guide,
        entry_alert_enabled: shop.entry_alert_enabled,
        entry_alert_min: shop.entry_alert_min ?? 120,
        last_order_alert_enabled: shop.last_order_alert_enabled,
        last_order_alert_min: shop.last_order_alert_min ?? 30,
        tip_enabled: shop.tip_enabled,
        ...Object.fromEntries(AI_TOGGLES.map((t) => [t.key, shop[t.key]])),
      }}
    >
      <Card title="店舗情報" style={{ marginTop: 16 }}>
        <Form.Item label="店舗名" extra="店舗名の変更は本部にお問い合わせください">
          <Input value={shop.name} disabled />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="name_en"
              label="英語店舗名"
              rules={[{ required: true, message: '英語店舗名を入力してください' }]}
            >
              <Input placeholder="Sumibiyaki Demo" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="last_order_label"
              label="ラストオーダーラベル"
              extra="モバイルオーダーに出す表記。例: ラストオーダー"
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="checkout_note" label="会計時の備考" extra="レシートの下部に載ります">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={12} sm={8}>
            <Form.Item name="open_time_min" label="開店時刻">
              <TimeMinInput disabled={!editable} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item
              name="close_time_min"
              label="閉店時刻"
              extra="24 時を超える場合は 25:00 や 31:00 のように書きます"
            >
              <TimeMinInput disabled={!editable} placeholder="23:30" />
            </Form.Item>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          message="アイコン画像のアップロードは未実装です"
          description="Supabase Storage への画像アップロードは、ストレージの設定と合わせて実装します。"
        />
      </Card>

      <Card title="注文の設定" style={{ marginTop: 16 }}>
        <Form.Item
          name="order_limit_enabled"
          label="1 回の注文の 1 人あたりの注文上限"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        {orderLimit && (
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="order_limit_per_person"
                label="上限数"
                rules={[{ required: true, message: '上限数を入力してください' }]}
              >
                <InputNumber min={1} suffix="点" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Form.Item
          name="sold_out_daily_reset"
          label="売り切れの日次リセット"
          valuePropName="checked"
          extra="営業日が変わったら、売り切れを自動で戻します"
        >
          <Switch />
        </Form.Item>

        <Form.Item name="note_input_enabled" label="備考入力" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="staff_call_enabled" label="スタッフ呼び出し" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Card>

      <Card title="会計の設定" style={{ marginTop: 16 }}>
        <Form.Item
          name="auto_checkout_slip"
          label="自動会計伝票機能"
          valuePropName="checked"
          extra="キッチンプリンターにのみ出せます"
        >
          <Switch />
        </Form.Item>

        <Form.Item name="show_tax_excluded_price" label="税抜価格表示設定" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="checkout_guide" label="会計ボタン押下後の画面">
          <Radio.Group
            options={[
              { value: 'wait_at_table', label: 'テーブルでスタッフをお待ちいただく案内' },
              { value: 'call_staff', label: 'スタッフにお声がけいただく案内' },
              { value: 'come_to_register', label: 'レジにお越しいただく案内' },
            ]}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          />
        </Form.Item>

        <Form.Item
          name="tip_enabled"
          label="チップ設定"
          valuePropName="checked"
          extra="会計画面で 0 / 5 / 10 / 15 / 20 / 25% から選べるようにします"
        >
          <Switch />
        </Form.Item>
      </Card>

      <Card title="レジ・ハンディのアラート設定" style={{ marginTop: 16 }}>
        <Form.Item name="entry_alert_enabled" label="入店時刻経過アラート" valuePropName="checked">
          <Switch />
        </Form.Item>

        {entryAlert && (
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="entry_alert_min" label="入店から何分で知らせるか">
                <InputNumber min={1} suffix="分" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Form.Item
          name="last_order_alert_enabled"
          label="最終注文時刻経過アラート"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        {lastOrderAlert && (
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="last_order_alert_min" label="最終注文から何分で知らせるか">
                <InputNumber min={1} suffix="分" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Card>

      <Card title="AI 機能" style={{ marginTop: 16 }}>
        {AI_TOGGLES.map((toggle) => (
          <Form.Item
            key={toggle.key}
            name={toggle.key}
            label={toggle.label}
            valuePropName="checked"
            extra={toggle.description}
          >
            <Switch />
          </Form.Item>
        ))}
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
          <Button onClick={() => router.push('/shop')}>キャンセル</Button>
          <Button type="primary" onClick={submit} loading={pending} disabled={!editable}>
            更 新
          </Button>
        </Space>
      </div>
    </Form>
  );
}
