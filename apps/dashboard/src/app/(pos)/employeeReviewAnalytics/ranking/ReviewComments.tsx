'use client';

import { Card, List, Space, Tag, Typography } from 'antd';

export interface ReviewComment {
  id: string;
  clerk_name: string;
  shop_name: string;
  is_good: boolean;
  comment: string;
  reviewed_at: string;
}

/**
 * 評価コメント（仕様書 §5.32）。
 * antd の List.Item.Meta などはサーバーコンポーネントから触れないので分けている。
 */
export function ReviewComments({ comments }: { comments: ReviewComment[] }) {
  return (
    <Card styles={{ body: { padding: 0 } }}>
      <List
        dataSource={comments}
        locale={{ emptyText: 'コメントがありません' }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        renderItem={(review) => (
          <List.Item style={{ padding: 16 }}>
            <List.Item.Meta
              title={
                <Space size={8} wrap>
                  <Tag color={review.is_good ? 'green' : 'red'}>
                    {review.is_good ? 'Good' : 'Bad'}
                  </Tag>
                  <Typography.Text strong>{review.clerk_name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {review.shop_name} / {review.reviewed_at.slice(0, 10)}
                  </Typography.Text>
                </Space>
              }
              description={review.comment}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
