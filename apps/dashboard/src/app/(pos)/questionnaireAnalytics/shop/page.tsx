import { Card, Col, Progress, Row, Statistic } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { ShopPicker } from '@/app/(pos)/previewUserApp/ShopPicker';
import { requireSession } from '@/lib/auth';
import { getQuestionnaireAnswers } from '@/lib/crmQueries';
import { breakdown, scoreByShop } from '@/lib/surveyAnalytics';
import { GENDER_LABELS, type CustomerGender } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'アンケート店舗詳細' };

/** 店舗詳細（仕様書 §5.32） */
export default async function SurveyShopPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];

  const answers = currentShop ? await getQuestionnaireAnswers([currentShop.id]) : [];
  const score = scoreByShop(answers)[0];
  const parts = breakdown(answers);

  const toRows = (entries: [string | number, number][], label: (key: string | number) => string) =>
    entries.map(([key, count]): DataRow => ({ key: String(key), label: label(key), count }));

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="アンケート店舗詳細"
        description={currentShop?.name ?? ''}
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: '店舗詳細' }]}
        extra={
          <ShopPicker
            shops={shops}
            shopId={currentShop?.id}
            basePath="/questionnaireAnalytics/shop"
          />
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={4}>
          <Card>
            <Statistic title="回答数" value={score?.answers ?? 0} suffix="件" />
          </Card>
        </Col>
        {[
          { label: '再来店意欲', value: score?.revisit ?? 0 },
          { label: '接客', value: score?.service ?? 0 },
          { label: '料理', value: score?.food ?? 0 },
          { label: '提供速度', value: score?.speed ?? 0 },
          { label: '清潔感', value: score?.clean ?? 0 },
        ].map((item) => (
          <Col key={item.label} xs={12} md={4}>
            <Card>
              <Statistic title={item.label} value={item.value} suffix="点" />
              <Progress percent={item.value} showInfo={false} size="small" />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <DataTable
            title="性別"
            rows={toRows(parts.byGender, (key) => GENDER_LABELS[key as CustomerGender])}
            emptyText="回答がありません"
            columns={[
              { title: '性別', key: 'label' },
              { title: '人数', key: 'count', align: 'right', format: { type: 'number' } },
            ]}
          />
        </Col>

        <Col xs={24} md={8}>
          <DataTable
            title="年代"
            rows={toRows(parts.byAge, (key) => `${key} 代`)}
            emptyText="回答がありません"
            columns={[
              { title: '年代', key: 'label' },
              { title: '人数', key: 'count', align: 'right', format: { type: 'number' } },
            ]}
          />
        </Col>

        <Col xs={24} md={8}>
          <DataTable
            title="認知経路"
            rows={toRows(parts.byChannel, (key) => String(key))}
            emptyText="回答がありません"
            columns={[
              { title: '経路', key: 'label' },
              { title: '人数', key: 'count', align: 'right', format: { type: 'number' } },
            ]}
          />
        </Col>
      </Row>

      <TableNote>点数は 5 段階の回答を 100 点換算にしたものです。</TableNote>
    </>
  );
}
