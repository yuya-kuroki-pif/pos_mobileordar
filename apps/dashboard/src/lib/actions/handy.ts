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

/**
 * ハンディのアカウント発行（仕様書 §5.18）。
 * 端末情報（機種・OS・バージョン）は端末が初回起動時に自分で申告するので、
 * ここでは枠だけ作って「未接続」にしておく。
 */
export async function issueHandyAccountAction(
  shopId: string,
  name: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'shop_management')) {
      throw new Error('ハンディを発行する権限がありません。');
    }
    if (!session.shops.some((shop) => shop.id === shopId)) {
      throw new Error('この店舗を操作する権限がありません。');
    }

    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'ハンディ名を入力してください。' };

    let id = '';

    if (isDemoMode()) {
      const state = db();
      id = `handy-${Math.random().toString(36).slice(2, 10)}`;
      state.handyTerminals.push({
        id,
        shop_id: shopId,
        name: trimmed,
        device_id: null,
        status: 'inactive',
        app_version: null,
        native_version: null,
        brand: null,
        model: null,
        os_name: null,
        os_version: null,
        registered_at: new Date().toISOString(),
      });
    } else {
      const { data, error } = await supabaseAdmin()
        .from('handy_terminals')
        .insert({ shop_id: shopId, name: trimmed, status: 'inactive' })
        .select('id')
        .single();
      if (error) throw error;
      id = (data as { id: string }).id;
    }

    revalidatePath('/handy');
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteHandyAction(shopId: string, id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'shop_management')) {
      throw new Error('ハンディを削除する権限がありません。');
    }

    if (isDemoMode()) {
      const state = db();
      state.handyTerminals = state.handyTerminals.filter((h) => h.id !== id);
    } else {
      const { error } = await supabaseAdmin()
        .from('handy_terminals')
        .delete()
        .eq('id', id)
        .eq('shop_id', shopId);
      if (error) throw error;
    }

    revalidatePath('/handy');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
