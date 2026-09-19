'use client';

import { Alert, Card, Col, Row, Statistic, Typography } from 'antd';

import { PageHeader } from '@/components/PageHeader';

/**
 * 顧客分析ダッシュボード（仕様書 §5.1）の器。
 * KPI カード 11 種・推移チャート・ランキングは集計基盤が要るため P3 で載せる。
 */
export function DashboardView({
  companyName,
  companyCount,
  shopCount,
  shopCountInCompany,
  accountName,
  accountEmail,
  roleName,
  corporationName,
}: {
  companyName: string;
  companyCount: number;
  shopCount: number;
  shopCountInCompany: number;
  accountName: string;
  accountEmail: string;
  roleName: string | null;
  corporationName: string;
}) {
  return (
    <>
      <PageHeader
        title="ダッシュボード"
        description="顧客 KPI と 30 日推移（仕様書 §5.1）"
        breadcrumb={[{ label: companyName }, { label: 'ダッシュボード' }]}
      />

      <Alert
        type="info"
        showIcon
        message="この画面は P3（分析フェーズ）で実装します"
        description="KPI カード 11 種・リピーター / アンバサダー / 推しエールの推移・各種ランキングは、日次集計テーブル（daily_summaries）が整ってから載せます。"
        style={{ marginBottom: 20 }}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="業態数" value={companyCount} suffix="業態" />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="店舗数（法人全体）" value={shopCount} suffix="店舗" />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title={`${companyName} の店舗`} value={shopCountInCompany} suffix="店舗" />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="ログイン中のアカウント">
        <Typography.Paragraph style={{ marginBottom: 4 }}>
          {accountName}（{accountEmail}）
        </Typography.Paragraph>
        <Typography.Text type="secondary">
          ロール: {roleName ?? '未割当'} ／ 法人: {corporationName}
        </Typography.Text>
      </Card>
    </>
  );
}
