import { StaffNav } from '@/components/StaffNav';
import { requireStore } from '@/lib/auth';
import { businessDate } from '@/lib/format';
import { getCashClosing, getCashMovements, getCashSales } from '@/lib/queries';

import { CloseDrawer } from './CloseDrawer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'レジ締め' };

export default async function ClosePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const store = await requireStore();
  const params = await searchParams;

  const today = businessDate(new Date(), store.timezone, store.business_day_cutoff_hour);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.day ?? '') ? (params.day as string) : today;

  const [cashSales, movements, closing] = await Promise.all([
    getCashSales(store.id, day),
    getCashMovements(store.id, day),
    getCashClosing(store.id, day),
  ]);

  return (
    <div className="min-h-screen bg-charcoal-50">
      <StaffNav storeName={store.name} current="pos" />
      <CloseDrawer
        businessDay={day}
        today={today}
        cashSales={cashSales}
        movements={movements}
        closing={closing}
        defaultFloat={store.cash_float_default}
      />
    </div>
  );
}
