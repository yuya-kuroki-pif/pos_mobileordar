import { StaffNav } from '@/components/StaffNav';
import { requireStore } from '@/lib/auth';
import { getFloorMap } from '@/lib/queries';

import { FloorMap } from './FloorMap';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'レジ' };

export default async function PosPage() {
  const store = await requireStore();
  const tables = await getFloorMap(store.id);

  return (
    <div className="min-h-screen bg-charcoal-50">
      <StaffNav storeName={store.name} current="pos" />
      <FloorMap initialTables={tables} />
    </div>
  );
}
