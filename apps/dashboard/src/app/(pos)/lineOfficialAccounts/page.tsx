import { Card, Col, Row, Statistic } from 'antd';

import { DataTable, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getLineAccounts } from '@/lib/crmQueries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'LINE公式アカウント一覧' };

/** LINE 公式アカウント一覧（仕様書 §5.31） */
export default async function LineAccountsPage() {
  const session = await requireSession();
  const accounts = await getLineAccounts(session.currentCompanyId);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';
  const totalFriends = accounts.reduce((sum, a) => sum + a.friends_total, 0);

  const rows: DataRow[] = accounts.map((account) => ({
    key: account.id,
    channel_id: account.channel_id,
    name: account.name,
    monthly_quota: account.monthly_quota,
    friends_total: account.friends_total,
    friends_active: account.friends_active,
    blocked: account.blocked,
  }));

  return (
    <>
      <PageHeader
        title="LINE公式アカウント一覧"
        description="業態に紐づく LINE 公式アカウントと、友だちの数"
        breadcrumb={[{ label: companyName }, { label: 'CRM' }, { label: 'LINE公式アカウント' }]}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="累計友だち数" value={totalFriends} suffix="人" />
          </Card>
        </Col>
      </Row>

      <DataTable
        rows={rows}
        emptyText="アカウントが登録されていません"
        columns={[
          { title: 'ID', key: 'channel_id', width: 160 },
          { title: 'アカウント名', key: 'name', width: 240 },
          { title: '今月の送信可能数', key: 'monthly_quota', width: 170, align: 'right', format: { type: 'number' } },
          { title: '累計友だち数', key: 'friends_total', width: 150, align: 'right', format: { type: 'number' } },
          { title: '有効友だち数', key: 'friends_active', width: 150, align: 'right', format: { type: 'number' } },
          { title: 'ブロック数', key: 'blocked', width: 130, align: 'right', format: { type: 'number' } },
        ]}
      />
    </>
  );
}
