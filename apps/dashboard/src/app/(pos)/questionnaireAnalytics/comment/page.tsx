import { Card, Col, Empty, Row, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';

import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getQuestionnaireAnswers } from '@/lib/crmQueries';
import { GENDER_LABELS } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'コメント一覧' };

/** コメント一覧（仕様書 §5.32） */
export default async function CommentPage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const answers = await getQuestionnaireAnswers(shops.map((s) => s.id));
  const withComment = answers
    .filter((a) => a.comment)
    .sort((a, b) => (a.answered_at < b.answered_at ? 1 : -1));

  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="コメント一覧"
        description="アンケートに書かれた自由記述"
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: 'コメント一覧' }]}
      />

      {withComment.length === 0 ? (
        <Card>
          <Empty description="コメントがありません" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {withComment.slice(0, 60).map((answer) => (
            <Col key={answer.id} xs={24} md={12} lg={8}>
              <Card size="small">
                <Typography.Paragraph style={{ marginBottom: 12 }}>
                  {answer.comment}
                </Typography.Paragraph>
                <Space size={4} wrap>
                  <Tag>{shopName.get(answer.shop_id) ?? answer.shop_id}</Tag>
                  <Tag>{GENDER_LABELS[answer.gender]}</Tag>
                  {answer.age && <Tag>{answer.age} 代</Tag>}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(answer.answered_at).format('YYYY/MM/DD')}
                  </Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
