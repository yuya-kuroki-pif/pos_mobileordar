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

  return <MenuManager menu={menu} uncategorized={uncategorized} />;
}
