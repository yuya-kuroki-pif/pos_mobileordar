'use client';

import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
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

import { ShopPasswordCard } from './ShopPasswordCard';

/** 点検・精算伝票に載せる売上詳細の内訳 */
const CLOSING_DETAILS: { key: keyof Shop; label: string }[] = [
  { key: 'closing_by_time_slot', label: '時間帯別' },
  { key: 'closing_by_location', label: '店内・店外' },
  { key: 'closing_by_area', label: 'エリア別' },
  { key: 'closing_by_menu_type', label: 'メニュータイプ別' },
  { key: 'closing_by_inflow', label: '媒体別' },
];

/** 店舗編集 — レジ設定タブ（仕様書 §5.12） */
export function RegisterSettingForm({ shop, editable }: { shop: Shop; editable: boolean }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    form
      .validateFields()
      .then((values) => {
        const patch: Partial<Shop> = {
          ...values,
          receipt_address: values.receipt_address?.trim() || null,
          contact_info: values.contact_info?.trim() || null,
          invoice_registration_number: values.invoice_registration_number?.trim() || null,
          stamp_tax_office: values.stamp_tax_office?.trim() || null,
          time_charge_rate: (values.time_charge_percent ?? 0) / 100,
          service_charge_rate: (values.service_charge_percent ?? 0) / 100,
        };
        delete (patch as Record<string, unknown>).time_charge_percent;
        delete (patch as Record<string, unknown>).service_charge_percent;

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
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginTop: 16 }}
        message="レジ端末上でのパスワード設定・変更はできません"
        description="ドロワーオープン・VOID・テーブルクリアのパスワードは、この画面から設定してください。"
      />
      <Alert
        type="warning"
        showIcon
        style={{ marginTop: 8 }}
        message="レジアプリのバージョンにご注意ください"
        description="古いバージョンのレジ端末には、ここで変えた設定が届かないことがあります。"
      />

      <Form
        form={form}
        layout="vertical"
        disabled={!editable}
        initialValues={{
          receipt_address: shop.receipt_address ?? '',
          contact_info: shop.contact_info ?? '',
          invoice_registration_number: shop.invoice_registration_number ?? '',
          stamp_tax_office: shop.stamp_tax_office ?? '',
          select_staff_on_checkout: shop.select_staff_on_checkout,
          change_fund_timing: shop.change_fund_timing,
          default_inflow_free: shop.default_inflow_free,
          show_zero_price_items: shop.show_zero_price_items,
          auto_round_discount: shop.auto_round_discount,
          open_drawer_on_cashless: shop.open_drawer_on_cashless,
          use_stera: shop.use_stera,
          receipt_auto_print: shop.receipt_auto_print,
          temp_receipt_enabled: shop.temp_receipt_enabled,
          closing_tax_included: shop.closing_tax_included,
          time_charge_percent: shop.time_charge_rate * 100,
          time_charge_start_min: shop.time_charge_start_min,
          time_charge_end_min: shop.time_charge_end_min,
          service_charge_percent: shop.service_charge_rate * 100,
          ...Object.fromEntries(CLOSING_DETAILS.map((d) => [d.key, shop[d.key]])),
        }}
      >
        <Card title="伝票に載せる情報" style={{ marginTop: 16 }}>
          <Form.Item name="receipt_address" label="伝票記載住所">
            <Input.TextArea rows={2} placeholder="東京都墨田区江東橋 0-0-0" />
          </Form.Item>

          <Form.Item name="contact_info" label="連絡先情報">
            <Input placeholder="03-0000-0000" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="invoice_registration_number"
                label="適格請求書発行事業者の登録番号"
                rules={[
                  {
                    pattern: /^T\d{13}$/,
                    message: 'T のあと数字 13 桁で入力してください',
                  },
                ]}
              >
                <Input placeholder="T1234567890123" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="stamp_tax_office"
                label="収入印紙の貼付省略による税務署名"
                extra="例: 本所税務署"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="会計の動き" style={{ marginTop: 16 }}>
          <Form.Item
            name="select_staff_on_checkout"
            label="会計時の担当者を毎回選択する"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item name="change_fund_timing" label="釣銭準備金入力のタイミング">
            <Radio.Group
              options={[
                { value: 'with_closing', label: 'レジ締め時に実施' },
                { value: 'separate', label: 'レジ締めと分けて実施' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="default_inflow_free"
            label="会計時の流入媒体選択のデフォルト値を「フリー」にする"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="show_zero_price_items"
            label="レシート・会計伝票に 0 円のメニュー・オプション・選択肢を表示する"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="auto_round_discount"
            label="自動端数値引"
            valuePropName="checked"
            extra="合計の 1 円単位を自動で値引きします"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="open_drawer_on_cashless"
            label="現金を扱わない会計時にもドロワーを開く"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Card>

        <Card title="レジ端末" style={{ marginTop: 16 }}>
          <Form.Item name="use_stera" label="stera を使用する" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="receipt_auto_print" label="レシート自動印刷設定" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="temp_receipt_enabled" label="臨時領収書発行" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Card>

        <Card title="点検・精算伝票" style={{ marginTop: 16 }}>
          <Form.Item label="売上詳細情報の表示" style={{ marginBottom: 8 }}>
            <Space direction="vertical">
              {CLOSING_DETAILS.map((detail) => (
                <Form.Item key={detail.key} name={detail.key} valuePropName="checked" noStyle>
                  <Checkbox>{detail.label}</Checkbox>
                </Form.Item>
              ))}
            </Space>
          </Form.Item>

          <Form.Item name="closing_tax_included" label="税表示">
            <Radio.Group
              options={[
                { value: true, label: '税込' },
                { value: false, label: '税抜' },
              ]}
            />
          </Form.Item>
        </Card>

        <Card title="割増設定" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="time_charge_percent" label="タイムチャージ料率">
                <InputNumber min={0} max={100} step={1} suffix="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="time_charge_start_min" label="適用時間帯（開始）">
                <TimeMinInput disabled={!editable} placeholder="22:00" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item
                name="time_charge_end_min"
                label="適用時間帯（終了）"
                extra="24 時を超える場合は 28:00 のように書きます"
              >
                <TimeMinInput disabled={!editable} placeholder="28:00" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="service_charge_percent" label="サービス料率">
                <InputNumber min={0} max={100} step={1} suffix="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <ShopPasswordCard shop={shop} editable={editable} />

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="会計レシート画像設定は未実装です"
          description="レシート上部・下部に入れる画像は、Supabase Storage への画像アップロードと合わせて実装します。"
        />

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
    </>
  );
}
