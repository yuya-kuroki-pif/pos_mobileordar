import { DataTable, TableNote, type DataRow } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getAccountAuditLogs } from '@/lib/extrasQueries';
import { ACCOUNT_ACTION_LABELS } from '@/lib/types';

import { AuditFilter } from './AuditFilter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'アカウント操作履歴' };

/** アカウント操作履歴（仕様書 §7.3 / §8.8） */
export default async function AccountAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; account?: string }>;
}) {
  const session = await requireSession();
  const { action, account } = await searchParams;

  const logs = await getAccountAuditLogs(session.corporation.id);

  const filtered = logs
    .filter((log) => !action || action === 'all' || log.action === action)
    .filter((log) => !account || account === 'all' || log.account_id === account)
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));

  const rows: DataRow[] = filtered.map((log) => ({
    key: log.id,
    occurred_at: log.occurred_at.slice(0, 16).replace('T', ' '),
    account_name: log.account_name ?? '（削除済み）',
    action: ACCOUNT_ACTION_LABELS[log.action] ?? log.action,
    target: log.target ?? '—',
    ip: log.ip ?? '—',
  }));

  // 絞り込みの選択肢は、実際にログに出てくるものだけ出す
  const actions = [...new Set(logs.map((log) => log.action))].map((value) => ({
    value,
    label: ACCOUNT_ACTION_LABELS[value] ?? value,
  }));
  const accounts = [...new Map(logs.map((log) => [log.account_id ?? '', log.account_name ?? ''])).entries()]
    .filter(([value]) => value)
    .map(([value, label]) => ({ value, label }));

  return (
    <>
      <PageHeader
        title="アカウント操作履歴"
        description="ダッシュボードにログインしたアカウントの操作ログです"
        breadcrumb={[{ label: session.corporation.name }, { label: '設定' }, { label: 'アカウント操作履歴' }]}
        extra={<AuditFilter actions={actions} accounts={accounts} action={action} account={account} />}
      />

      <DataTable
        rows={rows}
        pageSize={50}
        emptyText="操作履歴がありません"
        columns={[
          { title: '発生日時', key: 'occurred_at', width: 180, fixed: 'left' },
          { title: '実行者', key: 'account_name', width: 180 },
          { title: '操作', key: 'action', width: 180, format: { type: 'tag' } },
          { title: '対象', key: 'target', width: 320 },
          { title: 'IP アドレス', key: 'ip', width: 160 },
        ]}
      />

      <TableNote>
        レジ側の操作（ドロワーオープン・VOID・会計修正など）は
        「重要操作履歴一覧」に分けて記録しています。
      </TableNote>
    </>
  );
}
