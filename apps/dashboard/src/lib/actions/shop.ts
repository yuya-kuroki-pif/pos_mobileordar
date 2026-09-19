'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { BusinessHour, Shop, ShopPasswordKind } from '../types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

/** 店舗設定を触れるのは shop_management 権限を持つ人だけ */
async function requireShopEdit(shopId: string) {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'shop_management')) {
    throw new Error('店舗設定を編集する権限がありません。');
  }
  if (!session.shops.some((shop) => shop.id === shopId)) {
    throw new Error('この店舗を編集する権限がありません。');
  }
  return session;
}

/**
 * 店舗設定の保存。タブごとに触る列が違うので、
 * 画面が渡してきた列だけを更新する。
 */
export async function saveShopAction(shopId: string, patch: Partial<Shop>): Promise<ActionResult> {
  try {
    await requireShopEdit(shopId);

    // ハッシュ由来の派生値と主キーは保存対象に含めない
    const {
      id: _id,
      company_id: _companyId,
      has_drawer_open_password: _d,
      has_void_password: _v,
      has_table_clear_password: _t,
      ...payload
    } = patch as Partial<Shop> & Record<string, unknown>;

    if (Object.keys(payload).length === 0) return { ok: true, id: shopId };

    if (
      payload.close_time_min !== undefined &&
      payload.open_time_min !== undefined &&
      payload.close_time_min !== null &&
      payload.open_time_min !== null &&
      payload.close_time_min <= payload.open_time_min
    ) {
      return { ok: false, error: '閉店時刻は開店時刻より後にしてください（翌 1:00 なら 25:00）。' };
    }

    if (isDemoMode()) {
      const shop = db().shops.find((s) => s.id === shopId);
      if (!shop) return { ok: false, error: '店舗が見つかりません' };
      Object.assign(shop, payload);
    } else {
      const { error } = await supabaseAdmin().from('shops').update(payload).eq('id', shopId);
      if (error) throw error;
    }

    revalidatePath('/shop');
    revalidatePath(`/shop/${shopId}/edit`);
    revalidatePath(`/shop/${shopId}/register`);
    revalidatePath(`/shop/${shopId}/googleMap`);
    return { ok: true, id: shopId };
  } catch (error) {
    return fail(error);
  }
}

/**
 * レジ操作用パスワードの設定（ドロワーオープン / VOID / テーブルクリア）。
 * 保存はハッシュのみで、画面には戻さない。null を渡すと解除。
 */
export async function setShopPasswordAction(
  shopId: string,
  kind: ShopPasswordKind,
  password: string | null,
): Promise<ActionResult> {
  try {
    await requireShopEdit(shopId);

    if (password !== null && !/^[0-9A-Za-z]{4,}$/.test(password)) {
      return { ok: false, error: 'パスワードは英数字 4 文字以上にしてください。' };
    }

    if (isDemoMode()) {
      const shop = db().shops.find((s) => s.id === shopId);
      if (!shop) return { ok: false, error: '店舗が見つかりません' };
      const set = password !== null;
      if (kind === 'drawer_open') shop.has_drawer_open_password = set;
      if (kind === 'void') shop.has_void_password = set;
      if (kind === 'table_clear') shop.has_table_clear_password = set;
    } else {
      const { error } = await supabaseAdmin().rpc('set_shop_password', {
        p_shop_id: shopId,
        p_kind: kind,
        p_password: password,
      });
      if (error) throw error;
    }

    revalidatePath(`/shop/${shopId}/register`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 営業時間帯（§5.12）。行ごとにまとめて置き換える */
export async function saveBusinessHoursAction(
  shopId: string,
  rows: BusinessHour[],
): Promise<ActionResult> {
  try {
    await requireShopEdit(shopId);

    for (const row of rows) {
      if (!row.name.trim()) return { ok: false, error: '営業時間帯の名称を入力してください。' };
      if (row.end_min <= row.start_min) {
        return {
          ok: false,
          error: `「${row.name}」の終了時間は開始時間より後にしてください（翌 1:00 なら 25:00）。`,
        };
      }
    }

    if (isDemoMode()) {
      const state = db();
      state.businessHours = [
        ...state.businessHours.filter((b) => b.shop_id !== shopId),
        ...rows.map((row, index) => ({
          ...row,
          id: row.id.startsWith('tmp-') ? `bh-${Math.random().toString(36).slice(2, 10)}` : row.id,
          shop_id: shopId,
          name: row.name.trim(),
          display_order: (index + 1) * 10,
        })),
      ];
    } else {
      const supabase = supabaseAdmin();
      await supabase.from('business_hours').delete().eq('shop_id', shopId);

      if (rows.length > 0) {
        const { error } = await supabase.from('business_hours').insert(
          rows.map((row, index) => ({
            shop_id: shopId,
            name: row.name.trim(),
            start_min: row.start_min,
            end_min: row.end_min,
            display_order: (index + 1) * 10,
          })),
        );
        if (error) throw error;
      }
    }

    revalidatePath(`/shop/${shopId}/businessHours`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
