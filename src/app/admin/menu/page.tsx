import { requireStore } from '@/lib/auth';
import { getMenuTree } from '@/lib/queries';
import { supabaseAdmin } from '@/lib/supabase';
import type { MenuItem } from '@/lib/types';

import { MenuManager } from './MenuManager';

export const metadata = { title: 'メニュー管理' };

export default async function MenuAdminPage() {
  const store = await requireStore();

  // 管理画面では非公開の商品も見せる必要があるので onlyOrderable = false
  const menu = await getMenuTree(store.id, false);

  // カテゴリ未設定の商品も編集できるよう別に取得する
  const { data } = await supabaseAdmin()
    .from('menu_items')
    .select('*')
    .eq('store_id', store.id)
    .is('category_id', null)
    .order('sort_order');

  return <MenuManager menu={menu} uncategorized={(data ?? []) as MenuItem[]} />;
}
