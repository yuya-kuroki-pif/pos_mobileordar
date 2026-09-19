import { Alert, Card, Col, Row, Statistic } from 'antd';

import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getMessagingAccounts } from '@/lib/crmQueries';
import { CHANNEL_LABELS } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: '配信アカウント一覧' };

/**
 * 配信アカウント一覧（仕様書 §5.31 を Zalo にも広げたもの）。
 *
 * 日本の店舗は LINE、ベトナムの店舗は Zalo を使うので、
 * どちらも同じ表に並べてチャネル列で見分ける。
 */
export default async function MessagingAccountsPage() {
  const session = await requireSession();
  const accounts = await getMessagingAccounts(session.currentCompanyId);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  const line = accounts.filter((a) => a.channel === 'line');
  const zalo = accounts.filter((a) => a.channel === 'zalo');
  const sumFriends = (list: typeof accounts) =>
    list.reduce((sum, a) => sum + a.friends_total, 0);

  const rows: DataRow[] = accounts.map((account) => ({
    key: account.id,
    channel: CHANNEL_LABELS[account.channel],
    name: account.name,
    channel_id: account.channel_id,
    monthly_quota: account.monthly_quota,
    zns_quota: account.channel === 'zalo' ? account.zns_quota : null,
    friends_total: account.friends_total,
    friends_active: account.friends_active,
    blocked: account.blocked,
  }));

  return (
    <>
      <PageHeader
        title="配信アカウント一覧"
        description="メッセージを送るための公式アカウント（LINE / Zalo）"
        breadcrumb={[{ label: companyName }, { label: 'CRM' }, { label: '配信アカウント' }]}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="ベトナム向けの店舗では Zalo を使います"
        description="LINE と Zalo は別々のアカウントとして登録します。お客様がどちらで繋がっているかは、お客様ごとに持ちます。"
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="LINE 友だち数" value={sumFriends(line)} suffix="人" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Zalo フォロワー数" value={sumFriends(zalo)} suffix="人" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="アカウント数" value={accounts.length} suffix="件" />
          </Card>
        </Col>
      </Row>

      <DataTable
        rows={rows}
        emptyText="アカウントが登録されていません"
        columns={[
          { title: 'チャネル', key: 'channel', width: 110, format: { type: 'tag', color: 'blue' } },
          { title: 'アカウント名', key: 'name', width: 240 },
          { title: 'ID', key: 'channel_id', width: 180 },
          { title: '月間送信可能数', key: 'monthly_quota', width: 160, align: 'right', format: { type: 'number' } },
          { title: 'ZNS 上限', key: 'zns_quota', width: 130, align: 'right', format: { type: 'number' } },
          { title: '友だち・フォロワー', key: 'friends_total', width: 170, align: 'right', format: { type: 'number' } },
          { title: '有効', key: 'friends_active', width: 120, align: 'right', format: { type: 'number' } },
          { title: 'ブロック', key: 'blocked', width: 120, align: 'right', format: { type: 'number' } },
        ]}
      />

      <TableNote>
        ZNS は Zalo の通知メッセージです。あらかじめ登録したテンプレートでしか送れないため、
        通常のメッセージとは別枠になります。LINE のアカウントでは使いません。
      </TableNote>
    </>
  );
}
