import { requireSession } from '@/lib/auth';

import { CsvExportView } from './CsvExportView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CSVダウンロード' };

/** CSV ダウンロード（仕様書 §5.28） */
export default async function CsvExportPage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return <CsvExportView shops={shops} companyName={companyName} />;
}
