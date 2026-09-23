import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StaffNav } from '@/components/StaffNav';
import { requireStore } from '@/lib/auth';
import { SERVICE_TYPE_LABEL } from '@/lib/format';
import {
  getFloorMap,
  getMenuTree,
  getSession,
  getSessionItems,
  getSessionOrders,
  getSessionTotal,
  getShopPaymentMethods,
  getTables,
} from '@/lib/queries';

import { SessionView } from './SessionView';

export const dynamic = 'force-dynamic';
export const metadata = { title: '伝票' };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await requireStore();

  const session = await getSession(id);
  if (!session || session.store_id !== store.id) notFound();

  const [tables, items, orders, total, menu, floor, paymentMethods] = await Promise.all([
    getTables(store.id),
    getSessionItems(id),
    getSessionOrders(id),
    getSessionTotal(id),
    getMenuTree(store.id, true),
    getFloorMap(store.id),
    getShopPaymentMethods(store.company_id),
  ]);

  const table = tables.find((t) => t.id === session.table_id);

  // 会計済みの卓を開いた場合は伝票を読み取り専用で見せる
  const closed =
    session.status === 'closed' || session.status === 'cancelled' || session.status === 'merged';

  // 卓移動の候補（空いている卓）と、伝票結合の候補（他の利用中の伝票）
  const emptyTables = floor.filter((t) => !t.session && t.id !== session.table_id);
  const otherSessions = floor
    .filter((t) => t.session && t.session.id !== id)
    .map((t) => ({ sessionId: t.session!.id, tableName: t.name, total: t.current_total }));

  return (
    <div className="min-h-screen bg-charcoal-50">
      <StaffNav storeName={store.name} current="pos" />

      <div className="border-b border-charcoal-100 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <Link
            href="/pos"
            className="rounded-lg px-2 py-1 text-sm font-semibold text-charcoal-500 hover:bg-charcoal-100"
          >
            ← フロア
          </Link>
          <h1 className="text-xl font-bold">{table?.name ?? '卓'}</h1>
          <span className="text-sm text-charcoal-500">{session.guest_count} 名</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              session.service_type === 'takeout'
                ? 'bg-sky-100 text-sky-800'
                : 'bg-charcoal-100 text-charcoal-500'
            }`}
          >
            {SERVICE_TYPE_LABEL[session.service_type]}
          </span>
          {closed && (
            <span className="rounded-full bg-charcoal-100 px-3 py-1 text-xs font-bold text-charcoal-500">
              {session.status === 'merged' ? '結合済み' : '会計済み'}
            </span>
          )}
        </div>
      </div>

      <SessionView
        sessionId={id}
        initialSession={session}
        initialItems={items}
        orders={orders}
        initialTotal={total}
        menu={menu}
        store={store}
        paymentMethods={paymentMethods}
        emptyTables={emptyTables.map((t) => ({ id: t.id, name: t.name, area: t.area }))}
        otherSessions={otherSessions}
        readOnly={closed}
      />
    </div>
  );
}
