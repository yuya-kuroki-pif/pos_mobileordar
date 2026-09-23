'use client';

import { Alert, App, Button, Card, Col, Flex, Input, Rate, Row, Space, Statistic, Tag, Typography } from 'antd';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ShopPicker } from '@/components/ShopPicker';
import { saveReviewReplyAction } from '@/lib/actions/googleReview';
import type { GoogleReview } from '@/lib/types';

/** クチコミ獲得・返信（仕様書 §7.2） */
export function ReviewView({
  companyName,
  shops,
  shopId,
  connected,
  syncedAt,
  reviews,
  editable,
}: {
  companyName: string;
  shops: { id: string; name: string }[];
  shopId?: string;
  connected: boolean;
  syncedAt: string | null;
  reviews: GoogleReview[];
  editable: boolean;
}) {
  const { message } = App.useApp();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const replied = reviews.filter((r) => r.reply_text).length;
  const average =
    reviews.length === 0
      ? 0
      : Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10;

  function save(review: GoogleReview) {
    const text = drafts[review.id] ?? review.reply_text ?? '';
    setSaving(review.id);
    startTransition(async () => {
      const result = await saveReviewReplyAction(review.id, text);
      setSaving(null);
      if (!result.ok) {
        message.error(result.error ?? '返信を保存できませんでした');
        return;
      }
      message.success(
        connected ? '返信を投稿しました。' : '返信を下書きとして保存しました。'
      );
    });
  }

  return (
    <>
      <PageHeader
        title="クチコミ獲得"
        description="Google マップのクチコミを読み、返信します"
        breadcrumb={[{ label: companyName }, { label: '集客' }, { label: 'クチコミ獲得' }]}
        extra={<ShopPicker shops={shops} shopId={shopId} basePath="/attract/review" />}
      />

      {!connected && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Google ビジネスプロフィールと未接続です"
          description="接続すると、クチコミの取り込みと返信の投稿が自動になります。接続するまでは、ここで書いた返信はこのシステムの中に下書きとして保存されるだけで、Google には反映されません。"
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card><Statistic title="クチコミ件数" value={reviews.length} /></Card>
        </Col>
        <Col xs={8}>
          <Card><Statistic title="平均評価" value={average} suffix="/ 5.0" /></Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic
              title="返信率"
              value={reviews.length === 0 ? 0 : Math.round((replied / reviews.length) * 100)}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {syncedAt && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          最終取り込み: {syncedAt.slice(0, 16).replace('T', ' ')}
        </Typography.Paragraph>
      )}

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {reviews.length === 0 && (
          <Card>
            <Typography.Text type="secondary">クチコミがまだありません。</Typography.Text>
          </Card>
        )}

        {reviews.map((review) => (
          <Card key={review.id} size="small">
            <Flex justify="space-between" align="start" gap={12} wrap>
              <Space direction="vertical" size={4} style={{ flex: '1 1 360px' }}>
                <Space>
                  <Rate disabled value={review.rating} style={{ fontSize: 14 }} />
                  <Typography.Text strong>{review.author_name ?? '匿名'}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {review.posted_at.slice(0, 10)}
                  </Typography.Text>
                  {review.reply_text ? (
                    <Tag color="green">返信済み</Tag>
                  ) : (
                    <Tag color="orange">未返信</Tag>
                  )}
                </Space>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {review.comment ?? '（本文なし）'}
                </Typography.Paragraph>
              </Space>

              <Space direction="vertical" style={{ flex: '1 1 360px', width: '100%' }}>
                <Input.TextArea
                  value={drafts[review.id] ?? review.reply_text ?? ''}
                  onChange={(event) =>
                    setDrafts({ ...drafts, [review.id]: event.target.value })
                  }
                  placeholder="返信を書く"
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  disabled={!editable}
                />
                <Button
                  size="small"
                  type="primary"
                  onClick={() => save(review)}
                  loading={saving === review.id}
                  disabled={!editable}
                >
                  {connected ? '返信を投稿' : '下書きを保存'}
                </Button>
              </Space>
            </Flex>
          </Card>
        ))}
      </Space>
    </>
  );
}
