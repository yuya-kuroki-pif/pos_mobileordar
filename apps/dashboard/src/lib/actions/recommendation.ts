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

async function requireRecommendationEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'recommendation_menu')) {
    throw new Error('おすすめメニューを編集する権限がありません。');
  }
  return session;
}

/** おすすめセットの追加・更新（仕様書 §5.7）。含めるメニューも一緒に保存する */
export async function saveRecommendationSetAction(input: {
  id: string;
  name: string;
  display_name: string;
  display_order: number;
  menuIds: string[];
}): Promise<ActionResult> {
  try {
    const session = await requireRecommendationEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: 'おすすめセット名を入力してください。' };

    const payload = {
      name,
      display_name: input.display_name.trim() || null,
      display_order: input.display_order,
    };

    let setId = input.id;

    if (isDemoMode()) {
      const state = db();
      const existing = state.recommendationSets.find((s) => s.id === setId);
      if (existing) Object.assign(existing, payload);
      else {
        setId = `rs-${Math.random().toString(36).slice(2, 10)}`;
        state.recommendationSets.push({ id: setId, company_id: companyId, ...payload });
      }

      state.recommendationMenus = [
        ...state.recommendationMenus.filter((l) => l.set_id !== setId),
        ...input.menuIds.map((menuId, index) => ({
          set_id: setId,
          menu_id: menuId,
          display_order: (index + 1) * 10,
        })),
      ];
    } else {
      const supabase = supabaseAdmin();

      if (setId) {
        const { error } = await supabase
          .from('recommendation_sets')
          .update(payload)
          .eq('id', setId)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('recommendation_sets')
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        setId = (data as { id: string }).id;
      }

      await supabase.from('recommendation_menus').delete().eq('set_id', setId);
      if (input.menuIds.length > 0) {
        const { error } = await supabase.from('recommendation_menus').insert(
          input.menuIds.map((menuId, index) => ({
            set_id: setId,
            menu_id: menuId,
            display_order: (index + 1) * 10,
          }))
        );
        if (error) throw error;
      }
    }

    revalidatePath('/menuRecommendations');
    return { ok: true, id: setId };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRecommendationSetAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireRecommendationEdit();

    if (isDemoMode()) {
      const state = db();
      state.recommendationSets = state.recommendationSets.filter((s) => s.id !== id);
      state.recommendationMenus = state.recommendationMenus.filter((l) => l.set_id !== id);
      for (const link of state.shopRecommendations) {
        if (link.set_id === id) link.set_id = null;
      }
    } else {
      const { error } = await supabaseAdmin()
        .from('recommendation_sets')
        .delete()
        .eq('id', id)
        .eq('company_id', session.currentCompanyId);
      if (error) throw error;
    }

    revalidatePath('/menuRecommendations');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 店舗ごとの公開設定とセット選択（仕様書 §5.7） */
export async function setShopRecommendationAction(
  shopId: string,
  patch: { set_id?: string | null; is_visible?: boolean }
): Promise<ActionResult> {
  try {
    const session = await requireRecommendationEdit();
    if (!session.shops.some((shop) => shop.id === shopId)) {
      return { ok: false, error: 'この店舗を編集する権限がありません。' };
    }

    if (isDemoMode()) {
      const state = db();
      const existing = state.shopRecommendations.find((l) => l.shop_id === shopId);
      if (existing) Object.assign(existing, patch);
      else
        state.shopRecommendations.push({
          shop_id: shopId,
          set_id: null,
          is_visible: false,
          ...patch,
        });
    } else {
      const { error } = await supabaseAdmin()
        .from('shop_recommendations')
        .upsert({ shop_id: shopId, ...patch }, { onConflict: 'shop_id' });
      if (error) throw error;
    }

    revalidatePath('/menuRecommendations');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
