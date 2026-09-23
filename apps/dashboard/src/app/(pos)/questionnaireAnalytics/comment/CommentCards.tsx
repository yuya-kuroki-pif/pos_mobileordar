'use client';

import { Card, Col, Empty, Row, Space, Tag, Typography } from 'antd';

export interface CommentCard {
  id: string;
  comment: string;
  shop_name: string;
  gender_label: string;
  age: number | null;
  answered_on: string;
}

/**
 * コメント一覧のカード（仕様書 §5.32）。
 * antd の Typography.Paragraph などはサーバーコンポーネントから触れないので分けている。
 */
export function CommentCards({ comments }: { comments: CommentCard[] }) {
  if (comments.length === 0) {
    return (
      <Card>
        <Empty description="コメントがありません" />
      </Card>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      {comments.map((row) => (
        <Col key={row.id} xs={24} md={12} lg={8}>
          <Card size="small">
            <Typography.Paragraph style={{ marginBottom: 12 }}>
              {row.comment}
            </Typography.Paragraph>
            <Space size={4} wrap>
              <Tag>{row.shop_name}</Tag>
              <Tag>{row.gender_label}</Tag>
              {row.age !== null && <Tag>{row.age} 代</Tag>}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.answered_on}
              </Typography.Text>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
