'use client';

import { Alert, Card, Col, Progress, Row, Select, Statistic, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';
import type { Area, DailySummary, RestaurantTable, Shop } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/**
 * 売上速報（仕様書 §6.6）。
 *
 * 着地見込みは「今日までの実績 + 残り日数 × 直近 7 日の平均」で出す。
 * 曜日ごとの平均まで見るのは、データがもっと溜まってからにする。
 */
export function CurrentSalesView({
  shops,
  shopId,
  today,
  monthly,
  areas,
  tables,
  companyName,
}: {
  shops: Shop[];
  shopId?: string;
  today: string;
  monthly: DailySummary[];
  areas: Area[];
  tables: RestaurantTable[];
  companyName: string;
}) {
  const router = useRouter();

  const todayRow = monthly.find((d) => d.business_date === today);
  const past = monthly.filter((d) => d.business_date <= today);
  const actual = past.reduce((sum, d) => sum + d.sales, 0);
  const monthTarget = monthly.reduce((sum, d) => sum + d.target, 0);

  // 直近 7 日の平均で、残りの日を埋める
  const recent = past.filter((d) => d.sales > 0).slice(-7);
  const average =
    recent.length > 0 ? Math.round(recent.reduce((sum, d) => sum + d.sales, 0) / recent.length) : 0;
  const remaining = monthly.filter((d) => d.business_date > today).length;
  const forecast = actual + average * remaining;

  return (
    <>
      <PageHeader
        title="売上速報"
        description={`${dayjs().format('HH:mm')} 時点`}
        breadcrumb={[{ label: companyName }, { label: '経営管理' }, { label: '売上速報' }]}
        extra={
          shops.length > 0 && (
            <Select
              value={shopId}
              style={{ width: 240 }}
              onChange={(value) => router.push(`/bi/current-sales?shop=${value}`)}
              options={shops.map((s) => ({ value: s.id, label: s.name }))}
            />
          )
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card title="本日">
            <Statistic title="売上" value={todayRow?.sales ?? 0} prefix="¥" />
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              {todayRow?.group_count ?? 0} 組 / {todayRow?.guest_count ?? 0} 人 / 客単価 ¥
              {yen.format(
                todayRow && todayRow.guest_count > 0
                  ? Math.round(todayRow.sales / todayRow.guest_count)
                  : 0
              )}
            </Typography.Paragraph>
            {todayRow && todayRow.target > 0 && (
              <Progress
                percent={Math.round((todayRow.sales / todayRow.target) * 100)}
                strokeColor="#fa8c16"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="当月着地見込">
            <Statistic title="見込み" value={forecast} prefix="¥" />
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              実績 ¥{yen.format(actual)} ＋ 残り {remaining} 日 × 直近平均 ¥{yen.format(average)}
            </Typography.Paragraph>
            {monthTarget > 0 && (
              <>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  実績 / 月間目標
                </Typography.Text>
                <Progress percent={Math.round((actual / monthTarget) * 100)} strokeColor="#fa8c16" />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  着地見込 / 月間目標
                </Typography.Text>
                <Progress percent={Math.round((forecast / monthTarget) * 100)} />
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="店内状況はレジ・ハンディの動きに合わせて更新されます"
        description="いまは画面を開いた時点の卓の状態を出しています。自動更新はレジ側の接続と合わせて入れます。"
      />

      <Card title={`店内状況（${tables.length} 卓）`}>
        {areas.map((area) => {
          const areaTables = tables.filter((t) => t.area_id === area.id);
          if (areaTables.length === 0) return null;

          return (
            <div key={area.id} style={{ marginBottom: 16 }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                {area.name}
              </Typography.Text>
              <Row gutter={[8, 8]}>
                {areaTables.map((table) => (
                  <Col key={table.id} xs={12} sm={8} md={6} lg={4}>
                    <Card size="small" styles={{ body: { padding: 12 } }}>
                      <Typography.Text strong>{table.name}</Typography.Text>
                      <div style={{ marginTop: 4 }}>
                        <Tag>{table.seats ?? '—'} 席</Tag>
                        <Tag color={table.is_active ? undefined : 'default'}>
                          {table.is_active ? '空席' : '停止中'}
                        </Tag>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          );
        })}
      </Card>
    </>
  );
}
