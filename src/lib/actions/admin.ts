'use server';

import { revalidatePath } from 'next/cache';

import { getStaffSession } from '../auth';
import { supabaseAdmin } from '../supabase';
import type { PrepStation } from '../types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function requireStoreId(): Promise<string> {
  const session = await getStaffSession();
  if (!session) throw new Error('ログインの有効期限が切れました。再度ログインしてください。');
  return session.storeId;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

function num(form: FormData, key: string, fallback = 0): number {
  const raw = form.get(key);
  const value = Number(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(value) ? value : fallback;
}

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

// ===========================================================================
// カテゴリ
// ===========================================================================

export async function saveCategory(formData: FormData): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    const id = text(formData, 'id');
    const name = text(formData, 'name');
    if (!name) return { ok: false, error: 'カテゴリ名を入力してください。' };

    const payload = {
      store_id: storeId,
      name,
      description: text(formData, 'description') || null,
      sort_order: num(formData, 'sort_order'),
      is_active: formData.get('is_active') !== null,
    };

    const db = supabaseAdmin();
    const { error } = id
      ? await db.from('categories').update(payload).eq('id', id).eq('store_id', storeId)
      : await db.from('categories').insert(payload);
    if (error) throw error;

    revalidatePath('/admin/menu');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    // 商品は category_id が null になるだけで消えない（on delete set null）
    const { error } = await supabaseAdmin()
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId);
    if (error) throw error;

    revalidatePath('/admin/menu');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ===========================================================================
// 商品
// ===========================================================================

export async function saveMenuItem(formData: FormData): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    const id = text(formData, 'id');
    const name = text(formData, 'name');
    if (!name) return { ok: false, error: '商品名を入力してください。' };

    const price = Math.max(0, Math.round(num(formData, 'price')));

    const payload = {
      store_id: storeId,
      category_id: text(formData, 'category_id') || null,
      name,
      description: text(formData, 'description') || null,
      price,
      image_url: text(formData, 'image_url') || null,
      prep_station: (text(formData, 'prep_station') || 'kitchen') as PrepStation,
      is_available: formData.get('is_available') !== null,
      is_sold_out: formData.get('is_sold_out') !== null,
      sort_order: num(formData, 'sort_order'),
    };

    const db = supabaseAdmin();
    const { error } = id
      ? await db.from('menu_items').update(payload).eq('id', id).eq('store_id', storeId)
      : await db.from('menu_items').insert(payload);
    if (error) throw error;

    revalidatePath('/admin/menu');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 売切トグル。営業中に一番よく使う操作なので単独で用意する */
export async function toggleSoldOut(id: string, soldOut: boolean): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    const { error } = await supabaseAdmin()
      .from('menu_items')
      .update({ is_sold_out: soldOut })
      .eq('id', id)
      .eq('store_id', storeId);
    if (error) throw error;

    revalidatePath('/admin/menu');
    revalidatePath('/pos');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    // 過去の注文明細は name_snapshot を持っているので、商品を消しても伝票は壊れない
    const { error } = await supabaseAdmin()
      .from('menu_items')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId);
    if (error) throw error;

    revalidatePath('/admin/menu');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ===========================================================================
// 卓
// ===========================================================================

export async function saveTable(formData: FormData): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    const id = text(formData, 'id');
    const name = text(formData, 'name');
    if (!name) return { ok: false, error: '卓名を入力してください。' };

    const payload = {
      store_id: storeId,
      name,
      area: text(formData, 'area') || null,
      seats: Math.max(1, Math.round(num(formData, 'seats', 4))),
      sort_order: num(formData, 'sort_order'),
      is_active: formData.get('is_active') !== null,
    };

    const db = supabaseAdmin();
    const { error } = id
      ? await db.from('restaurant_tables').update(payload).eq('id', id).eq('store_id', storeId)
      : await db.from('restaurant_tables').insert(payload);
    if (error) throw error;

    revalidatePath('/admin/tables');
    revalidatePath('/pos');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTable(id: string): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    const { error } = await supabaseAdmin()
      .from('restaurant_tables')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId);
    if (error) {
      // 過去のセッションから参照されている卓は消せない（on delete restrict）
      if (error.code === '23503') {
        return {
          ok: false,
          error: 'この卓には利用履歴があるため削除できません。「利用しない」に切り替えてください。',
        };
      }
      throw error;
    }

    revalidatePath('/admin/tables');
    revalidatePath('/pos');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** QR トークンを作り直す。印刷済み QR を失効させたいときに使う */
export async function regenerateQrToken(id: string): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    const token = crypto.randomUUID().replace(/-/g, '');

    const { error } = await supabaseAdmin()
      .from('restaurant_tables')
      .update({ qr_token: token })
      .eq('id', id)
      .eq('store_id', storeId);
    if (error) throw error;

    revalidatePath('/admin/tables');
    return { ok: true, id: token };
  } catch (error) {
    return fail(error);
  }
}

// ===========================================================================
// 店舗設定
// ===========================================================================

export async function saveStoreSettings(formData: FormData): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();

    const payload = {
      name: text(formData, 'name'),
      // 画面では「10」%で入力させ、DB には 0.10 で持つ
      tax_rate: num(formData, 'tax_rate', 10) / 100,
      tax_included: text(formData, 'tax_included') === 'included',
      service_charge_rate: num(formData, 'service_charge_rate') / 100,
      mobile_order_open: formData.get('mobile_order_open') !== null,
      opening_note: text(formData, 'opening_note') || null,
      business_day_cutoff_hour: Math.min(12, Math.max(0, Math.round(num(formData, 'cutoff', 5)))),
    };

    if (!payload.name) return { ok: false, error: '店舗名を入力してください。' };

    const { error } = await supabaseAdmin().from('stores').update(payload).eq('id', storeId);
    if (error) throw error;

    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function changePin(formData: FormData): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    const pin = text(formData, 'pin');

    if (!/^\d{4,8}$/.test(pin)) {
      return { ok: false, error: 'PIN は 4〜8 桁の数字で入力してください。' };
    }

    const { error } = await supabaseAdmin().rpc('set_staff_pin', {
      p_store_id: storeId,
      p_pin: pin,
    });
    if (error) throw error;

    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
