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
  Select,
  Space,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ImageUpload } from '@/components/ImageUpload';
import { saveMenuAction, type MenuFormInput } from '@/lib/actions/menu';
import type { CategoryRow, MenuDetail } from '@/lib/types';

/**
 * 基本情報タブ（仕様書 §5.3）。
 * 商品画像・メニュー情報・販売価格と原価・注文制限のセクションに分かれる。
 */
export function MenuBasicForm({
  detail,
  categories,
  editable,
}: {
  detail: MenuDetail | null;
  categories: CategoryRow[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const menu = detail?.menu;
  const [imageUrl, setImageUrl] = useState<string | null>(menu?.image_url ?? null);

  function submit() {
    setError(null);
    form
      .validateFields()
      .then((values) => {
        const input: MenuFormInput = {
          id: menu?.id ?? '',
          name: values.name,
          receipt_display_name: values.receipt_display_name ?? '',
          staff_display_name: values.staff_display_name ?? '',
          description: values.description ?? '',
          featured_label: values.featured_label ?? '',
          menu_type: values.menu_type,
          image_size: values.image_size,
          tax_method: values.tax_method,
          tax_rate: values.tax_rate,
          price: values.price ?? 0,
          cost_price: values.cost_price ?? null,
          is_takeout: values.is_takeout ?? false,
          is_free_key: values.is_free_key ?? false,
          is_notice_only: values.is_notice_only ?? false,
          reduced_rate_eligible: values.reduced_rate_eligible ?? true,
          display_order: values.display_order ?? 0,
          image_url: imageUrl,
          categoryIds: values.categoryIds ?? [],
        };

        startTransition(async () => {
          const result = await saveMenuAction(input);
          if (!result.ok || !result.id) {
            setError(result.error ?? '保存できませんでした');
            return;
          }
          message.success('保存しました');
          if (!menu) router.push(`/menu/${result.id}/edit`);
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
        name: menu?.name ?? '',
        receipt_display_name: menu?.receipt_display_name ?? '',
        staff_display_name: menu?.staff_display_name ?? '',
        description: menu?.description ?? '',
        featured_label: menu?.featured_label ?? '',
        categoryIds: detail?.categoryIds ?? [],
        menu_type: menu?.menu_type ?? 'food',
        image_size: menu?.image_size ?? 'medium',
        tax_method: menu?.tax_method ?? 'incl',
        tax_rate: menu?.tax_rate ?? 0.1,
        price: menu?.price ?? 0,
        cost_price: menu?.cost_price ?? null,
        is_takeout: menu?.is_takeout ?? false,
        is_free_key: menu?.is_free_key ?? false,
        is_notice_only: menu?.is_notice_only ?? false,
        reduced_rate_eligible: menu?.reduced_rate_eligible ?? true,
        display_order: menu?.display_order ?? 0,
      }}
    >
      <Card title="メニュー情報" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="メニュー名"
          rules={[{ required: true, message: 'メニュー名を入力してください' }]}
        >
          <Input />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="receipt_display_name" label="伝票表示名" extra="空欄ならメニュー名を使います">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="staff_display_name" label="スタッフ表示名">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="categoryIds" label="カテゴリ" extra="複数のカテゴリに置けます">
          <Select
            mode="multiple"
            allowClear
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>

        <Form.Item name="menu_type" label="メニュータイプ">
          <Radio.Group
            options={[
              { value: 'food', label: 'フード' },
              { value: 'drink', label: 'ドリンク' },
              { value: 'other', label: 'その他' },
            ]}
          />
        </Form.Item>

        <Form.Item name="description" label="メニュー説明文（日本語）">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="featured_label" label="特集ラベル（日本語）" extra="例: おすすめ">
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

        <Form.Item label="商品画像">
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            folder="menu"
            width={216}
            height={144}
            hint="モバイルオーダーとハンディに出ます。5MB まで"
            disabled={!editable}
          />
        </Form.Item>
      </Card>

      <Card title="販売価格と原価" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Form.Item name="is_takeout" valuePropName="checked" style={{ marginBottom: 4 }}>
            <Checkbox>店外メニューとして利用する（テイクアウト / デリバリー売上として集計）</Checkbox>
          </Form.Item>
          <Form.Item name="is_free_key" valuePropName="checked" style={{ marginBottom: 4 }}>
            <Checkbox>フリーキーとして利用する（ハンディで都度価格を入力。MO には出さない）</Checkbox>
          </Form.Item>
          <Form.Item name="is_notice_only" valuePropName="checked" style={{ marginBottom: 16 }}>
            <Checkbox>案内用（注文できない。説明文だけを載せる）</Checkbox>
          </Form.Item>
        </Space>

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
          <Col xs={24} sm={8}>
            <Form.Item name="price" label="販売価格" rules={[{ required: true }]}>
              <InputNumber prefix="¥" min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="reduced_rate_eligible" valuePropName="checked">
          <Checkbox>持ち帰りなら軽減税率 8%（酒類・非飲食料品はチェックを外す）</Checkbox>
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="cost_price" label="原価">
              <InputNumber prefix="¥" min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
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
          <Button onClick={() => router.push('/menu')}>キャンセル</Button>
          <Button type="primary" onClick={submit} loading={pending} disabled={!editable}>
            {menu ? '更 新' : '作 成'}
          </Button>
        </Space>
      </div>
    </Form>
  );
}
