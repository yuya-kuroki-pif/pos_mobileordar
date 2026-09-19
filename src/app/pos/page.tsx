import Link from 'next/link';

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
      <div className="border-b border-charcoal-100 bg-white px-4 py-2">
        <div className="mx-auto flex max-w-7xl justify-end">
          <Link
            href="/pos/close"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-charcoal-500 hover:bg-charcoal-100"
          >
            レジ締め
          </Link>
        </div>
      </div>
      <FloorMap initialTables={tables} />
    </div>
  );
}
