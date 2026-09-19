import { requireSession } from '@/lib/auth';
import { getAuditLogRows } from '@/lib/transactionQueries';

import { AuditLogView } from './AuditLogView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '重要操作履歴一覧' };

/** 重要操作履歴一覧（仕様書 §5.26） */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; event?: string; from?: string; to?: string }>;
}) {
  const session = await requireSession();
  const { shop, event, from, to } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const targetIds = shop ? [shop] : shops.map((s) => s.id);

  const rows = await getAuditLogRows(targetIds, { eventType: event, from, to });
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <AuditLogView
      rows={rows}
      shops={shops}
      filter={{ shop, event, from, to }}
      companyName={companyName}
    />
  );
}
