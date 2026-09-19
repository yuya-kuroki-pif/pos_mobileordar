import { requireSession } from '@/lib/auth';
import { getMobileOrderDesign } from '@/lib/companyQueries';
import { getMenuRows } from '@/lib/menuQueries';
import { canEdit } from '@/lib/permissions';

import { MobileOrderDesignView } from './MobileOrderDesignView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'モバイルオーダーデザイン設定' };

/** モバイルオーダーデザイン設定（仕様書 §5.11） */
export default async function MobileOrderDesignPage() {
  const session = await requireSession();

  const [design, menus] = await Promise.all([
    getMobileOrderDesign(session.currentCompanyId),
    getMenuRows(session.currentCompanyId),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <MobileOrderDesignView
      design={design}
      // プレビューに出すだけなので先頭の数件で足りる
      sampleMenus={menus.slice(0, 6).map((m) => ({ id: m.id, name: m.name, price: m.price }))}
      companyName={companyName}
      editable={canEdit(session.permissions, 'company_management')}
    />
  );
}
