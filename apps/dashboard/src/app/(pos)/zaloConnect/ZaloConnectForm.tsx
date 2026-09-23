'use client';

import { Alert, App, Button, Card, Form, Input, Radio, Select, Space, Tag, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { saveZaloConnectAction } from '@/lib/actions/zaloConnect';
import {
  ZALO_LOGIN_MODE_LABELS,
  type ZaloConnectSettings,
  type ZaloLoginMode,
} from '@/lib/types';

/** Zalo ログイン連携の設定（案A） */
export function ZaloConnectForm({
  companyName,
  settings,
  coupons,
  editable,
  loginConfigured,
  znsConfigured,
}: {
  companyName: string;
  settings: ZaloConnectSettings;
  coupons: { id: string; name: string }[];
  editable: boolean;
  loginConfigured: boolean;
  znsConfigured: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();

  function submit() {
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveZaloConnectAction({
          app_id: values.app_id ?? '',
          oa_id: values.oa_id ?? '',
          login_mode: values.login_mode,
          follow_coupon_id: values.follow_coupon_id ?? null,
          headline: values.headline ?? '',
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

  return (
    <>
      <PageHeader
        title="Zalo ログイン連携"
        description="モバイルオーダーを開いたお客様を Zalo で特定し、来店履歴とお知らせの配信につなげます"
        breadcrumb={[{ label: companyName }, { label: 'CRM' }, { label: 'Zalo ログイン連携' }]}
        tags={[loginConfigured ? '接続済み' : '未接続']}
      />

      {!loginConfigured && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Zalo のアプリがまだ設定されていません"
          description={
            <>
              <code>ZALO_APP_ID</code> と <code>ZALO_APP_SECRET</code> を .env.local
              に設定すると、お客様の Zalo ログインが動きます。設定するまで、モバイルオーダーには
              「準備中」と出して注文だけはできるようにしています。
            </>
          }
        />
      )}

      {!znsConfigured && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="ZNS（お知らせ配信）は別のトークンが要ります"
          description={
            <>
              <code>ZALO_OA_ACCESS_TOKEN</code> を設定し、Zalo でテンプレートの承認を受けると、
              メッセージ配信から実際に送れるようになります。
            </>
          }
        />
      )}

      <Form
        form={form}
        layout="vertical"
        disabled={!editable}
        initialValues={{
          app_id: settings.app_id ?? '',
          oa_id: settings.oa_id ?? '',
          login_mode: settings.login_mode,
          follow_coupon_id: settings.follow_coupon_id,
          headline: settings.headline ?? '',
        }}
      >
        <Card title="接続先" style={{ marginBottom: 16 }}>
          <Form.Item
            name="app_id"
            label="Zalo App ID"
            extra="Zalo Developers で登録したアプリの ID（公開値）"
          >
            <Input placeholder="例: 1234567890123456789" />
          </Form.Item>

          <Form.Item
            name="oa_id"
            label="Official Account ID"
            extra="フォロー用リンク（zalo.me/◯◯）に使います"
          >
            <Input placeholder="例: 1234567890123456789" />
          </Form.Item>

          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            App Secret とアクセストークンは、画面ではなく環境変数で管理しています。
            ここには保存されません。
          </Typography.Paragraph>
        </Card>

        <Card title="お客様への出し方" style={{ marginBottom: 16 }}>
          <Form.Item name="login_mode" label="モバイルオーダーを開いたとき">
            <Radio.Group
              options={(Object.keys(ZALO_LOGIN_MODE_LABELS) as ZaloLoginMode[]).map((value) => ({
                value,
                label: ZALO_LOGIN_MODE_LABELS[value],
              }))}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="「スキップ可」をおすすめします"
            description="連携しないと注文できない形にすると、その注文自体を失います。スキップされても損はしないので、特典を強くするほうが結果的にフォロワーも売上も増えます。"
          />

          <Form.Item
            name="headline"
            label="画面に出す一言"
            extra="空欄なら「お得な情報をお届けします」と出ます。お客様の言語に合わせた訳は用意済みです"
          >
            <Input placeholder="例: 次回使えるクーポンをお送りします" />
          </Form.Item>

          <Form.Item
            name="follow_coupon_id"
            label="フォロー特典"
            extra="設定すると、連携画面の一番目立つところに出ます"
          >
            <Select
              allowClear
              placeholder="特典なし"
              options={coupons.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        </Card>

        <Card title="連携でできるようになること" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={4}>
            <Typography.Text>
              <Tag color="green">取得</Tag> Zalo のユーザー ID・表示名（お客様の承認した範囲）
            </Typography.Text>
            <Typography.Text>
              <Tag color="green">記録</Tag> 来店履歴・来店回数・会員ランク
            </Typography.Text>
            <Typography.Text>
              <Tag color="green">配信</Tag> メッセージ配信の条件絞り込みの対象になります
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              販促のお知らせは、お客様が受信に同意した方だけに送ってください。
              同意の有無と取得日時はお客様ごとに記録しています。
            </Typography.Text>
          </Space>
        </Card>

        <div style={{ textAlign: 'right' }}>
          <Button type="primary" onClick={submit} loading={pending} disabled={!editable}>
            保存
          </Button>
        </div>
      </Form>
    </>
  );
}
