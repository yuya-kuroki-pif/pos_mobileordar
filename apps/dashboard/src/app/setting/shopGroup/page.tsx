import { requireSession } from '@/lib/auth';
import { getShopGroups } from '@/lib/queries';

import { ShopGroupView } from './ShopGroupView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '店舗グループ' };

export default async function ShopGroupPage() {
  const session = await requireSession();
  const groups = await getShopGroups(session.corporation.id);

  const shopNames = Object.fromEntries(session.shops.map((shop) => [shop.id, shop.name]));

  return <ShopGroupView groups={groups} shopNames={shopNames} />;
}
