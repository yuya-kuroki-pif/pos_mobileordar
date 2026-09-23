import { Card, Col, Progress, Row, Statistic } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import type { AssessmentInput } from '@/lib/actions/assessment';
import { getShopSummaries, monthRange } from '@/lib/analyticsQueries';
import { isAiConfigured } from '@/lib/anthropic';
import { requireSession } from '@/lib/auth';
import { getKpiTargets } from '@/lib/biQueries';
import { getQuestionnaireAnswers } from '@/lib/crmQueries';
import { scoreByShop } from '@/lib/surveyAnalytics';

import { AssessmentComments } from './AssessmentComments';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI 店舗診断' };

/**
 * AI 店舗診断（仕様書 §7.1）。
 *
 * 数字の並びは常に出し、診断コメントは AI が設定されていれば
 * ボタンを押したときだけ生成する。未設定でも機械的な一文は出る。
 */
export default async function ShopAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  const { month } = await searchParams;

  const yearMonth = month ?? new Date().toISOString().slice(0, 7);
  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const shopIds = shops.map((s) => s.id);

  const [summaries, targets, answers] = await Promise.all([
    getShopSummaries(shopIds, monthRange(yearMonth)),
    getKpiTargets(shopIds, yearMonth),
    getQuestionnaireAnswers(shopIds),
  ]);

  const scores = scoreByShop(answers);
  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  const rows: DataRow[] = shops
    .map((shop) => {
      const summary = summaries.find((s) => s.shop_id === shop.id);
      const target = targets.find((t) => t.shop_id === shop.id);
      const score = scores.find((s) => s.shop_id === shop.id);

      const sales = summary?.sales ?? 0;
      const salesRate = target?.sales_target ? (sales / target.sales_target) * 100 : 0;
      const average = score?.average ?? 0;

      return {
        key: shop.id,
        name: shopName.get(shop.id) ?? shop.id,
        average,
        sales,
        sales_rate: salesRate,
        guests: summary?.guest_count ?? 0,
        avg_spend:
          summary && summary.guest_count > 0 ? Math.round(sales / summary.guest_count) : 0,
        revisit: score?.revisit ?? 0,
        food: score?.food ?? 0,
        service: score?.service ?? 0,
        clean: score?.clean ?? 0,
        speed: score?.speed ?? 0,
      };
    })
    .sort((a, b) => Number(b.average) - Number(a.average));

  const totalSales = summaries.reduce((sum, s) => sum + s.sales, 0);
  const totalTarget = targets.reduce((sum, t) => sum + t.sales_target, 0);
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.average, 0) / scores.length)
      : 0;

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  // AI に渡す数字。画面に出しているものと同じ
  const assessmentInputs: AssessmentInput[] = rows.map((row) => ({
    name: String(row.name),
    sales: Number(row.sales),
    sales_rate: Number(row.sales_rate),
    guests: Number(row.guests),
    avg_spend: Number(row.avg_spend),
    revisit: Number(row.revisit),
    service: Number(row.service),
    food: Number(row.food),
    speed: Number(row.speed),
    clean: Number(row.clean),
  }));

  /** 一番よい指標と一番わるい指標を拾って、一言にする */
  function comment(row: DataRow): string {
    const items = [
      { label: '再来店意欲', value: Number(row.revisit) },
      { label: '料理', value: Number(row.food) },
      { label: '接客', value: Number(row.service) },
      { label: '清潔感', value: Number(row.clean) },
      { label: '提供速度', value: Number(row.speed) },
    ].filter((item) => item.value > 0);

    if (items.length === 0) return 'アンケートの回答がまだありません。';

    const best = items.reduce((a, b) => (a.value >= b.value ? a : b));
    const worst = items.reduce((a, b) => (a.value <= b.value ? a : b));
    const rate = Number(row.sales_rate);

    const salesPart =
      rate === 0
        ? '売上目標が未設定です。'
        : rate >= 100
          ? `売上は目標を ${(rate - 100).toFixed(0)}% 上回っています。`
          : `売上は目標に ${(100 - rate).toFixed(0)}% 届いていません。`;

    return `${salesPart} ${best.label}（${best.value}点）が強く、${worst.label}（${worst.value}点）に伸びしろがあります。`;
  }

  return (
    <>
      <PageHeader
        title="AI 店舗診断"
        description="売上とアンケートを並べて、店舗ごとの強みと弱みを見ます"
        breadcrumb={[{ label: companyName }, { label: 'AI' }, { label: '店舗診断' }]}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card>
            <Statistic title="全店舗 今月売上" value={totalSales} prefix="¥" />
            {totalTarget > 0 && (
              <Progress percent={Math.round((totalSales / totalTarget) * 100)} />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card>
            <Statistic title="アンケート平均" value={averageScore} suffix="点" />
            <Progress percent={averageScore} showInfo={false} />
          </Card>
        </Col>
      </Row>

      <DataTable
        title="店舗ランキング"
        rows={rows}
        emptyText="店舗がありません"
        columns={[
          { title: '#', key: 'rank', width: 60, fixed: 'left', format: { type: 'index' } },
          { title: '店舗', key: 'name', width: 220, fixed: 'left' },
          { title: '総合', key: 'average', width: 120, align: 'right', format: { type: 'scoreTag' } },
          { title: '売上', key: 'sales', width: 140, align: 'right', format: { type: 'money' } },
          { title: '達成率', key: 'sales_rate', width: 110, align: 'right', format: { type: 'percent' } },
          { title: '客数', key: 'guests', width: 100, align: 'right', format: { type: 'number' } },
          { title: '客単価', key: 'avg_spend', width: 120, align: 'right', format: { type: 'money' } },
          { title: '再来店', key: 'revisit', width: 110, align: 'right', format: { type: 'scoreTag' } },
          { title: '料理', key: 'food', width: 110, align: 'right', format: { type: 'scoreTag' } },
          { title: '接客', key: 'service', width: 110, align: 'right', format: { type: 'scoreTag' } },
          { title: '清潔感', key: 'clean', width: 110, align: 'right', format: { type: 'scoreTag' } },
          { title: '速度', key: 'speed', width: 110, align: 'right', format: { type: 'scoreTag' } },
        ]}
      />

      <AssessmentComments
        shops={assessmentInputs}
        fallback={Object.fromEntries(rows.map((row) => [String(row.name), comment(row)]))}
        yearMonth={yearMonth}
        aiReady={isAiConfigured()}
      />

      <TableNote>点数はアンケートの 5 段階を 100 点換算にしたものです。</TableNote>
    </>
  );
}
