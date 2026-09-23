'use client';

import { ThunderboltOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Space, Spin, Typography } from 'antd';
import { useState, useTransition } from 'react';

import {
  generateAssessmentAction,
  type AssessmentInput,
} from '@/lib/actions/assessment';

/**
 * 診断コメント（仕様書 §7.1）。
 *
 * 既定では数字から機械的に作った一文を出す。
 * AI が設定されていれば、ボタンを押したときだけ生成しに行く。
 * 勝手に毎回呼ばないのは、画面を開くたびに費用がかかるのを避けるため。
 */
export function AssessmentComments({
  shops,
  fallback,
  yearMonth,
  aiReady,
}: {
  shops: AssessmentInput[];
  /** 店舗名 → 機械的に作った一文 */
  fallback: Record<string, string>;
  yearMonth: string;
  aiReady: boolean;
}) {
  const { message } = App.useApp();
  const [comments, setComments] = useState<Record<string, string> | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateAssessmentAction(shops, yearMonth);
      if (!result.ok || !result.comments) {
        message.error(result.error ?? '診断コメントを作れませんでした');
        return;
      }
      setComments(result.comments);
    });
  }

  const shown = comments ?? fallback;

  return (
    <Card
      title="診断コメント"
      style={{ marginTop: 16 }}
      extra={
        <Button
          icon={<ThunderboltOutlined />}
          onClick={generate}
          loading={pending}
          disabled={!aiReady}
          type={comments ? 'default' : 'primary'}
        >
          {comments ? 'もう一度作る' : 'AI に診断させる'}
        </Button>
      }
    >
      {!aiReady && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="AI の接続先が未設定です"
          description="ANTHROPIC_API_KEY を .env.local に設定すると、数字を読んだ診断コメントが出せます。いまは数字から機械的に作った一文を出しています。"
        />
      )}

      {comments && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message="AI が作ったコメントです"
          description="渡した数字だけを根拠にしています。打ち手はそのまま実行せず、現場の事情と合わせて判断してください。"
        />
      )}

      {pending && (
        <Space style={{ marginBottom: 12 }}>
          <Spin size="small" />
          <Typography.Text type="secondary">数字を読んでいます…</Typography.Text>
        </Space>
      )}

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {shops.map((shop) => (
          <div key={shop.name}>
            <Typography.Text strong>{shop.name}</Typography.Text>
            <div style={{ color: '#595959', fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {shown[shop.name] ?? fallback[shop.name] ?? '—'}
            </div>
          </div>
        ))}
      </Space>
    </Card>
  );
}
