import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';
import { getAccountingDetail } from '@/lib/transactionQueries';

import { AccountingDetailView } from './AccountingDetailView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '会計詳細' };

/** 会計詳細（仕様書 §5.23） */
export default async function AccountingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const detail = await getAccountingDetail(id);
  if (!detail) notFound();

  const shop = session.shops.find((s) => s.id === detail.payment.store_id);
  if (!shop) notFound();

  const companyName = session.companies.find((c) => c.id === shop.company_id)?.name ?? '業態';

  return (
    <AccountingDetailView
      detail={detail}
      shopName={shop.name}
      companyName={companyName}
      editable={canEdit(session.permissions, 'accounting_history')}
    />
  );
}
