'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

async function requireShopEdit(shopId: string) {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'shop_management')) {
    throw new Error('印刷設定を編集する権限がありません。');
  }
  if (!session.shops.some((shop) => shop.id === shopId)) {
    throw new Error('この店舗を編集する権限がありません。');
  }
  return session;
}

/** プランオプションごとの出力先（仕様書 §5.16） */
export async function setPlanOptionPrinterAction(
  shopId: string,
  planOptionId: string,
  printerId: string | null
): Promise<ActionResult> {
  try {
    await requireShopEdit(shopId);

    if (isDemoMode()) {
      // デモでは対応づけを保持しない（テーブルだけ用意している）
      db();
    } else {
      const { error } = await supabaseAdmin()
        .from('plan_option_printers')
        .upsert(
          { shop_id: shopId, plan_option_id: planOptionId, kitchen_printer_id: printerId },
          { onConflict: 'shop_id,plan_option_id' }
        );
      if (error) throw error;
    }

    revalidatePath('/printing/mainOption');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** キッチン表示・印刷順（仕様書 §5.16）。並べ替えた結果をまとめて保存する */
export async function saveKitchenOrderAction(
  shopId: string,
  categoryIds: string[]
): Promise<ActionResult> {
  try {
    await requireShopEdit(shopId);

    if (isDemoMode()) {
      const state = db();
      categoryIds.forEach((categoryId, index) => {
        const category = state.categories.find((c) => c.id === categoryId);
        if (category) category.display_order = (index + 1) * 10;
      });
    } else {
      const supabase = supabaseAdmin();
      await supabase.from('shop_category_orders').delete().eq('shop_id', shopId);

      if (categoryIds.length > 0) {
        const { error } = await supabase.from('shop_category_orders').insert(
          categoryIds.map((categoryId, index) => ({
            shop_id: shopId,
            category_id: categoryId,
            display_order: (index + 1) * 10,
          }))
        );
        if (error) throw error;
      }
    }

    revalidatePath('/menu/kitchen-display-order/edit');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
