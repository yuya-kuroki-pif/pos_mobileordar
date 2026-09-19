import { requireStore } from '@/lib/auth';
import { getMenuTree, getUncategorizedItems } from '@/lib/queries';

import { MenuManager } from './MenuManager';

export const metadata = { title: 'メニュー管理' };

export default async function MenuAdminPage() {
  const store = await requireStore();

  const [menu, uncategorized] = await Promise.all([
    // 管理画面では非公開の商品も見せる必要があるので onlyOrderable = false
    getMenuTree(store.id, false),
    getUncategorizedItems(store.id),
  ]);

  // 端末からダッシュボードの編集画面へ飛べるようにする
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000';

  return <MenuManager menu={menu} uncategorized={uncategorized} dashboardUrl={dashboardUrl} />;
}
