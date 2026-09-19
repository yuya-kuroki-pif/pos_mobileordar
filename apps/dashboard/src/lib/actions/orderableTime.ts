'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { OrderableTimeSlot } from '../types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

async function requireShopEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'shop_management')) {
    throw new Error('アプリ表示時間を編集する権限がありません。');
  }
  return session;
}

/**
 * アプリ表示時間の追加・更新（仕様書 §5.14）。
 * 曜日の行が無い＝その曜日は表示しない、という扱い。
 */
export async function saveOrderableTimeAction(input: {
  id: string;
  name: string;
  slots: Omit<OrderableTimeSlot, 'orderable_time_id'>[];
}): Promise<ActionResult> {
  try {
    const session = await requireShopEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: '名前を入力してください。' };

    for (const slot of input.slots) {
      if (slot.end_min <= slot.start_min) {
        return { ok: false, error: '終了時間は開始時間より後にしてください（翌 4:00 なら 28:00）。' };
      }
    }

    let id = input.id;

    if (isDemoMode()) {
      const state = db();
      const existing = state.orderableTimes.find((t) => t.id === id);
      if (existing) existing.name = name;
      else {
        id = `ot-${Math.random().toString(36).slice(2, 10)}`;
        state.orderableTimes.push({ id, company_id: companyId, name });
      }

      state.orderableTimeSlots = [
        ...state.orderableTimeSlots.filter((s) => s.orderable_time_id !== id),
        ...input.slots.map((slot) => ({ ...slot, orderable_time_id: id })),
      ];
    } else {
      const supabase = supabaseAdmin();

      if (id) {
        const { error } = await supabase
          .from('orderable_times')
          .update({ name })
          .eq('id', id)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('orderable_times')
          .insert({ company_id: companyId, name })
          .select('id')
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }

      await supabase.from('orderable_time_slots').delete().eq('orderable_time_id', id);
      if (input.slots.length > 0) {
        const { error } = await supabase
          .from('orderable_time_slots')
          .insert(input.slots.map((slot) => ({ ...slot, orderable_time_id: id })));
        if (error) throw error;
      }
    }

    revalidatePath('/orderableTime/shop');
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteOrderableTimeAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireShopEdit();

    if (isDemoMode()) {
      const state = db();
      state.orderableTimes = state.orderableTimes.filter((t) => t.id !== id);
      state.orderableTimeSlots = state.orderableTimeSlots.filter(
        (s) => s.orderable_time_id !== id
      );
      state.shopOrderableTimes = state.shopOrderableTimes.filter(
        (l) => l.orderable_time_id !== id
      );
    } else {
      const { error } = await supabaseAdmin()
        .from('orderable_times')
        .delete()
        .eq('id', id)
        .eq('company_id', session.currentCompanyId);
      if (error) throw error;
    }

    revalidatePath('/orderableTime/shop');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 店舗へのアプリ表示時間の割り当て */
export async function setShopOrderableTimeAction(
  shopId: string,
  timeId: string,
  assigned: boolean
): Promise<ActionResult> {
  try {
    const session = await requireShopEdit();
    if (!session.shops.some((shop) => shop.id === shopId)) {
      return { ok: false, error: 'この店舗を編集する権限がありません。' };
    }

    if (isDemoMode()) {
      const state = db();
      state.shopOrderableTimes = state.shopOrderableTimes.filter(
        (l) => !(l.shop_id === shopId && l.orderable_time_id === timeId)
      );
      if (assigned) state.shopOrderableTimes.push({ shop_id: shopId, orderable_time_id: timeId });
    } else {
      const supabase = supabaseAdmin();
      if (assigned) {
        const { error } = await supabase
          .from('shop_orderable_times')
          .upsert({ shop_id: shopId, orderable_time_id: timeId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shop_orderable_times')
          .delete()
          .eq('shop_id', shopId)
          .eq('orderable_time_id', timeId);
        if (error) throw error;
      }
    }

    revalidatePath('/orderableTime/shop');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
