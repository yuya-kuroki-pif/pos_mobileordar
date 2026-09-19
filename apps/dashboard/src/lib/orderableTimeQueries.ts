import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type { OrderableTime, OrderableTimeSlot } from './types';

/** アプリ表示時間設定（仕様書 §5.14）が必要とする一式 */
export interface OrderableTimeBoard {
  times: OrderableTime[];
  slots: OrderableTimeSlot[];
  /** 店舗に割り当てられているアプリ表示時間 */
  shopLinks: { shop_id: string; orderable_time_id: string }[];
}

export async function getOrderableTimeBoard(
  companyId: string,
  shopIds: string[]
): Promise<OrderableTimeBoard> {
  if (isDemoMode()) {
    const state = db();
    const times = state.orderableTimes.filter((t) => t.company_id === companyId);
    const ids = new Set(times.map((t) => t.id));

    return {
      times: clone(times),
      slots: clone(state.orderableTimeSlots.filter((s) => ids.has(s.orderable_time_id))),
      shopLinks: clone(state.shopOrderableTimes.filter((l) => shopIds.includes(l.shop_id))),
    };
  }

  const supabase = supabaseAdmin();

  const timeRes = await supabase
    .from('orderable_times')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at');
  if (timeRes.error) throw new Error(timeRes.error.message);

  const times = (timeRes.data ?? []) as OrderableTime[];
  const ids = times.map((t) => t.id);

  const [slotRes, linkRes] = await Promise.all([
    ids.length > 0
      ? supabase.from('orderable_time_slots').select('*').in('orderable_time_id', ids)
      : Promise.resolve({ data: [], error: null }),
    shopIds.length > 0
      ? supabase.from('shop_orderable_times').select('*').in('shop_id', shopIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (slotRes.error) throw new Error(slotRes.error.message);
  if (linkRes.error) throw new Error(linkRes.error.message);

  return {
    times,
    slots: (slotRes.data ?? []) as OrderableTimeSlot[],
    shopLinks: (linkRes.data ?? []) as { shop_id: string; orderable_time_id: string }[],
  };
}
