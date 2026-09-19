import { StaffNav } from '@/components/StaffNav';
import { requireStore } from '@/lib/auth';
import { getKdsItems } from '@/lib/queries';

import { KdsBoard } from './KdsBoard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'キッチン' };

export default async function KdsPage() {
  const store = await requireStore();
  const items = await getKdsItems(store.id);

  return (
    <div className="min-h-screen bg-charcoal-900">
      <StaffNav storeName={store.name} current="kds" tone="dark" />
      <KdsBoard initialItems={items} />
    </div>
  );
}
