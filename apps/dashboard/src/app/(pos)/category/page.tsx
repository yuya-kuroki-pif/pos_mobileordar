import { requireSession } from '@/lib/auth';
import { getCategoryRows } from '@/lib/menuQueries';

import { CategoryListView } from './CategoryListView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'カテゴリ' };

/** カテゴリ一覧（仕様書 §5.6 / 画像 06_category_list.jpg） */
export default async function CategoryListPage() {
  const session = await requireSession();
  const categories = await getCategoryRows(session.currentCompanyId);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return <CategoryListView categories={categories} companyName={companyName} />;
}
