'use client';

import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveShopAction } from '@/lib/actions/shop';
import type { Shop } from '@/lib/types';

const PLACE_ID_LOOKUP =
  'https://developers.google.com/maps/documentation/places/web-service/place-id';

/** 店舗編集 — Google マップ設定タブ（仕様書 §5.12） */
export function GoogleMapForm({ shop, editable }: { shop: Shop; editable: boolean }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    form.validateFields().then((values) => {
      const patch: Partial<Shop> = {
        google_place_id: values.google_place_id?.trim() || null,
        gmap_review_from_survey: values.gmap_review_from_survey ?? false,
        gmap_review_promote_mo: values.gmap_review_promote_mo ?? false,
        gmap_review_min_minutes: values.gmap_review_min_minutes ?? null,
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
    });
  }

  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!editable}
      initialValues={{
        google_place_id: shop.google_place_id ?? '',
        gmap_review_from_survey: shop.gmap_review_from_survey,
        gmap_review_promote_mo: shop.gmap_review_promote_mo,
        gmap_review_min_minutes: shop.gmap_review_min_minutes ?? 60,
      }}
    >
      <Card title="Google マップ設定" style={{ marginTop: 16 }}>
        <Form.Item
          name="google_place_id"
          label="プレイス ID"
          extra={
            <>
              Google マップ上の店舗を指す ID です。
              <Typography.Link href={PLACE_ID_LOOKUP} target="_blank" rel="noreferrer">
                取得ページ
              </Typography.Link>
              で調べられます。
            </>
          }
        >
          <Input placeholder="ChIJ..." />
        </Form.Item>

        <Form.Item
          name="gmap_review_from_survey"
          label="アンケート内容を Google マップで口コミ投稿できるようにする"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="gmap_review_promote_mo"
          label="モバイルオーダーで口コミ投稿の促進を表示する"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="gmap_review_min_minutes"
          label="最初の注文からの最低経過時間"
          extra="この時間が経つまでは口コミの案内を出しません"
        >
          <InputNumber min={0} suffix="分" style={{ width: 200 }} />
        </Form.Item>
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
