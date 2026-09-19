import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { getClosingDetail } from '@/lib/transactionQueries';

import { ClosingDetailView } from './ClosingDetailView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '日次処理詳細' };

/** 日次処理詳細（仕様書 §5.22） */
export default async function ClosingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string; date: string }>;
  searchParams: Promise<{ index?: string }>;
}) {
  const { shopId, date } = await params;
  const { index } = await searchParams;
  const session = await requireSession();

  const shop = session.shops.find((s) => s.id === shopId);
  if (!shop) notFound();

  const detail = await getClosingDetail(shopId, date, Number(index ?? 0));
  if (!detail) notFound();

  const companyName = session.companies.find((c) => c.id === shop.company_id)?.name ?? '業態';

  return <ClosingDetailView detail={detail} shopName={shop.name} companyName={companyName} />;
}
