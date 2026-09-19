'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

async function requireTableEdit(shopId: string) {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'shop_management')) {
    throw new Error('テーブルを編集する権限がありません。');
  }
  if (!session.shops.some((shop) => shop.id === shopId)) {
    throw new Error('この店舗を編集する権限がありません。');
  }
  return session;
}

function token() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/** エリアの追加・改名（仕様書 §5.19） */
export async function saveAreaAction(
  shopId: string,
  id: string,
  name: string,
  displayOrder: number
): Promise<ActionResult> {
  try {
    await requireTableEdit(shopId);

    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'エリア名を入力してください。' };

    let areaId = id;
    const payload = { name: trimmed, display_order: displayOrder };

    if (isDemoMode()) {
      const state = db();
      const existing = state.areas.find((a) => a.id === areaId);
      if (existing) Object.assign(existing, payload);
      else {
        areaId = `area-${token().slice(0, 8)}`;
        state.areas.push({ id: areaId, shop_id: shopId, ...payload });
      }
    } else {
      const supabase = supabaseAdmin();
      if (areaId) {
        const { error } = await supabase
          .from('areas')
          .update(payload)
          .eq('id', areaId)
          .eq('shop_id', shopId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('areas')
          .insert({ shop_id: shopId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        areaId = (data as { id: string }).id;
      }
    }

    revalidatePath('/table');
    return { ok: true, id: areaId };
  } catch (error) {
    return fail(error);
  }
}

/** エリアの削除。配下のテーブルはエリア未設定に戻す（on delete set null） */
export async function deleteAreaAction(shopId: string, id: string): Promise<ActionResult> {
  try {
    await requireTableEdit(shopId);

    if (isDemoMode()) {
      const state = db();
      state.areas = state.areas.filter((a) => a.id !== id);
      for (const table of state.restaurantTables) {
        if (table.area_id === id) table.area_id = null;
      }
    } else {
      const { error } = await supabaseAdmin()
        .from('areas')
        .delete()
        .eq('id', id)
        .eq('shop_id', shopId);
      if (error) throw error;
    }

    revalidatePath('/table');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export interface TableFormInput {
  id: string;
  name: string;
  area_id: string | null;
  seats: number | null;
  sort_order: number;
  is_active: boolean;
}

/** テーブルの追加・更新（仕様書 §5.19） */
export async function saveTableAction(
  shopId: string,
  input: TableFormInput
): Promise<ActionResult> {
  try {
    await requireTableEdit(shopId);

    const name = input.name.trim();
    if (!name) return { ok: false, error: 'テーブル名を入力してください。' };

    const payload = {
      name,
      area_id: input.area_id,
      seats: input.seats,
      sort_order: input.sort_order,
      is_active: input.is_active,
    };

    let tableId = input.id;

    if (isDemoMode()) {
      const state = db();
      const existing = state.restaurantTables.find((t) => t.id === tableId);
      if (existing) Object.assign(existing, payload);
      else {
        tableId = `table-${token().slice(0, 8)}`;
        state.restaurantTables.push({
          id: tableId,
          store_id: shopId,
          qr_token: token(),
          ...payload,
        });
      }
    } else {
      const supabase = supabaseAdmin();
      if (tableId) {
        const { error } = await supabase
          .from('restaurant_tables')
          .update(payload)
          .eq('id', tableId)
          .eq('store_id', shopId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('restaurant_tables')
          .insert({ store_id: shopId, qr_token: token(), ...payload })
          .select('id')
          .single();
        if (error) throw error;
        tableId = (data as { id: string }).id;
      }
    }

    revalidatePath('/table');
    return { ok: true, id: tableId };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTableAction(shopId: string, id: string): Promise<ActionResult> {
  try {
    await requireTableEdit(shopId);

    if (isDemoMode()) {
      const state = db();
      state.restaurantTables = state.restaurantTables.filter((t) => t.id !== id);
    } else {
      // 会計済みの卓は取引が参照しているので、消せない場合はそのまま例外にする
      const { error } = await supabaseAdmin()
        .from('restaurant_tables')
        .delete()
        .eq('id', id)
        .eq('store_id', shopId);
      if (error) throw error;
    }

    revalidatePath('/table');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 並び替え（ドラッグ）の結果を保存する */
export async function reorderTablesAction(
  shopId: string,
  orders: { id: string; sort_order: number; area_id: string | null }[]
): Promise<ActionResult> {
  try {
    await requireTableEdit(shopId);

    if (isDemoMode()) {
      const state = db();
      for (const row of orders) {
        const table = state.restaurantTables.find((t) => t.id === row.id);
        if (table) {
          table.sort_order = row.sort_order;
          table.area_id = row.area_id;
        }
      }
    } else {
      const supabase = supabaseAdmin();
      for (const row of orders) {
        const { error } = await supabase
          .from('restaurant_tables')
          .update({ sort_order: row.sort_order, area_id: row.area_id })
          .eq('id', row.id)
          .eq('store_id', shopId);
        if (error) throw error;
      }
    }

    revalidatePath('/table');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
