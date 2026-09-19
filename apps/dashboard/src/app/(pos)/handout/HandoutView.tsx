'use client';

import { ReloadOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Descriptions, Modal, Select, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { reissueShopPinAction } from '@/lib/actions/handout';
import type { Shop } from '@/lib/types';

/**
 * 配布物（仕様書 §5.21）。
 *
 * PIN はハッシュでしか持っていないため、指示書の「表示」ボタンではなく
 * 「再発行してその場で 1 回だけ見せる」形にしている。誰がいつ再発行したかは
 * アカウント操作履歴に残す。
 */
export function HandoutView({
  shops,
  shop,
  dashboardEmail,
  companyName,
  editable,
}: {
  shops: Shop[];
  shop?: Shop;
  dashboardEmail: string;
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [issued, setIssued] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reissue() {
    if (!shop) return;
    startTransition(async () => {
      const result = await reissueShopPinAction(shop.id);
      if (!result.ok || !result.password) {
        message.error(result.error ?? '再発行できませんでした');
        return;
      }
      setIssued(result.password);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="配布物"
        description="店舗へ渡すログイン情報をまとめています"
        breadcrumb={[{ label: companyName }, { label: '店舗管理' }, { label: '配布物' }]}
        extra={
          shops.length > 0 && (
            <Select
              value={shop?.id}
              style={{ width: 240 }}
              onChange={(value) => router.push(`/handout?shop=${value}`)}
              options={shops.map((s) => ({ value: s.id, label: s.name }))}
            />
          )
        }
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="パスワードは保存していません"
        description="レジ・ハンディの PIN はハッシュにして保存しているため、後から元の値を表示することはできません。分からなくなった場合は再発行してください。再発行するとそれまでの PIN は使えなくなります。"
      />

      {shop ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card title="ダッシュボード">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="ログイン ID">{dashboardEmail}</Descriptions.Item>
              <Descriptions.Item label="パスワード">
                <Typography.Text type="secondary">
                  アカウントごとに設定します（設定 → アカウント）
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title="レジ・ハンディ"
            extra={
              <Button
                icon={<ReloadOutlined />}
                loading={pending}
                disabled={!editable}
                onClick={reissue}
              >
                PIN を再発行
              </Button>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="店舗コード">{shop.slug}</Descriptions.Item>
              <Descriptions.Item label="PIN">
                <Typography.Text type="secondary">••••••（表示できません）</Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      ) : (
        <Card>
          <Typography.Text type="secondary">この業態には店舗がありません。</Typography.Text>
        </Card>
      )}

      <Modal
        open={issued !== null}
        title="PIN を再発行しました"
        okText="閉じる"
        cancelButtonProps={{ style: { display: 'none' } }}
        onOk={() => setIssued(null)}
        onCancel={() => setIssued(null)}
      >
        <Typography.Paragraph>
          この画面を閉じると二度と表示できません。控えてから閉じてください。
        </Typography.Paragraph>
        <Typography.Title level={2} copyable style={{ letterSpacing: 4 }}>
          {issued}
        </Typography.Title>
      </Modal>
    </>
  );
}
