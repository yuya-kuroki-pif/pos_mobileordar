import { Alert, Card, Col, Row, Statistic } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { getShopSummaries, monthRange } from '@/lib/analyticsQueries';
import { requireSession } from '@/lib/auth';
import { getQuestionnaireAnswers } from '@/lib/crmQueries';

export const dynamic = 'force-dynamic';
export const metadata = { title: '集客ダッシュボード' };

/**
 * 集客ダッシュボード（仕様書 §7.2）。
 *
 * Google ビジネスプロフィールとの接続はこれからなので、いまは
 * 手元にある数字（来店の組数とアンケートの認知経路）で組み立てている。
 */
export default async function AttractDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  const { month } = await searchParams;

  const yearMonth = month ?? new Date().toISOString().slice(0, 7);
  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const shopIds = shops.map((s) => s.id);

  const [summaries, answers] = await Promise.all([
    getShopSummaries(shopIds, monthRange(yearMonth)),
    getQuestionnaireAnswers(shopIds, `${yearMonth}-01`, `${yearMonth}-31`),
  ]);

  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  // 認知経路の内訳。Google 由来をまとめて拾う
  const byChannel = new Map<string, number>();
  for (const answer of answers) {
    const key = answer.awareness_channel ?? '未回答';
    byChannel.set(key, (byChannel.get(key) ?? 0) + 1);
  }

  const googleCount = [...byChannel.entries()]
    .filter(([key]) => key.startsWith('Google'))
    .reduce((sum, [, count]) => sum + count, 0);

  const channelRows: DataRow[] = [...byChannel.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      channel: key,
      count,
      share: answers.length > 0 ? (count / answers.length) * 100 : 0,
    }));

  const shopRows: DataRow[] = summaries.map((summary) => {
    const shopAnswers = answers.filter((a) => a.shop_id === summary.shop_id);
    return {
      key: summary.shop_id,
      name: shopName.get(summary.shop_id) ?? summary.shop_id,
      groups: summary.group_count,
      guests: summary.guest_count,
      answers: shopAnswers.length,
      google: shopAnswers.filter((a) => (a.awareness_channel ?? '').startsWith('Google')).length,
    };
  });

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="集客ダッシュボード"
        description="どこからお客様が来ているかを見ます"
        breadcrumb={[{ label: companyName }, { label: '集客' }, { label: 'ダッシュボード' }]}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Google ビジネスプロフィールとの接続はこれからです"
        description="経路検索数やクチコミ件数は、連携が済んでから出せるようになります。いまはアンケートの「認知経路」で代わりに見ています。"
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="来店組数"
              value={summaries.reduce((sum, s) => sum + s.group_count, 0)}
              suffix="組"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="アンケート回答数" value={answers.length} suffix="件" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Google 経由" value={googleCount} suffix="件" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Google 経由の割合"
              value={answers.length > 0 ? (googleCount / answers.length) * 100 : 0}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <DataTable
            title="認知経路"
            rows={channelRows}
            emptyText="回答がありません"
            columns={[
              { title: '経路', key: 'channel' },
              { title: '件数', key: 'count', width: 100, align: 'right', format: { type: 'number' } },
              { title: '割合', key: 'share', width: 100, align: 'right', format: { type: 'percent' } },
            ]}
          />
        </Col>

        <Col xs={24} lg={12}>
          <DataTable
            title="店舗別"
            rows={shopRows}
            emptyText="店舗がありません"
            columns={[
              { title: '店舗名', key: 'name' },
              { title: '組数', key: 'groups', width: 90, align: 'right', format: { type: 'number' } },
              { title: '客数', key: 'guests', width: 90, align: 'right', format: { type: 'number' } },
              { title: '回答数', key: 'answers', width: 90, align: 'right', format: { type: 'number' } },
              { title: 'Google 経由', key: 'google', width: 120, align: 'right', format: { type: 'number' } },
            ]}
          />
        </Col>
      </Row>

      <TableNote>認知経路はアンケートの回答をそのまま数えています。</TableNote>
    </>
  );
}
