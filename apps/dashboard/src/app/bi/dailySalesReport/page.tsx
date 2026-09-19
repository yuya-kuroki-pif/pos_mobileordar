import { requireSession } from '@/lib/auth';
import { getDailySummaries, getHourlySummaries } from '@/lib/analyticsQueries';
import { getDailyReport } from '@/lib/biQueries';
import { getAuditLogRows, getCashClosings } from '@/lib/transactionQueries';

import { DailyReportView } from './DailyReportView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '日報' };

/** 日報（仕様書 §6.3） */
export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; date?: string }>;
}) {
  const session = await requireSession();
  const { shop, date } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];
  const businessDate = date ?? new Date().toISOString().slice(0, 10);

  const shopIds = currentShop ? [currentShop.id] : [];
  const monthStart = `${businessDate.slice(0, 7)}-01`;

  const [daily, monthly, closings, audits, report, hourly] = await Promise.all([
    getDailySummaries(shopIds, { from: businessDate, to: businessDate }),
    getDailySummaries(shopIds, { from: monthStart, to: businessDate }),
    getCashClosings(shopIds, businessDate),
    getAuditLogRows(shopIds, { from: businessDate, to: businessDate }),
    currentShop ? getDailyReport(currentShop.id, businessDate) : Promise.resolve(null),
    getHourlySummaries(shopIds, { from: businessDate, to: businessDate }),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <DailyReportView
      shops={shops}
      shopId={currentShop?.id}
      shopName={currentShop?.name ?? ''}
      businessDate={businessDate}
      today={daily[0] ?? null}
      monthToDate={monthly}
      closing={closings[0] ?? null}
      audits={audits}
      hourly={hourly}
      comment={report?.comment ?? ''}
      companyName={companyName}
    />
  );
}
