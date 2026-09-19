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

export interface TargetInput {
  sales_target: number;
  food_cost_target: number;
  drink_cost_target: number;
  labor_target: number;
  sga_target: number;
  guest_target: number;
  avg_spend_target: number;
}

async function requireTargetEdit(shopId: string) {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'target_management')) {
    throw new Error('目標を編集する権限がありません。');
  }
  if (!session.shops.some((shop) => shop.id === shopId)) {
    throw new Error('この店舗を編集する権限がありません。');
  }
  return session;
}

/** 月間目標の保存（仕様書 §6.7） */
export async function saveKpiTargetAction(
  shopId: string,
  yearMonth: string,
  input: TargetInput
): Promise<ActionResult> {
  try {
    await requireTargetEdit(shopId);

    if (isDemoMode()) {
      const state = db();
      const existing = state.kpiTargets.find(
        (t) => t.shop_id === shopId && t.year_month === yearMonth
      );
      if (existing) Object.assign(existing, input);
      else
        state.kpiTargets.push({
          id: `${shopId}-${yearMonth}`,
          shop_id: shopId,
          year_month: yearMonth,
          ...input,
        });
    } else {
      const { error } = await supabaseAdmin()
        .from('kpi_targets')
        .upsert(
          { shop_id: shopId, year_month: yearMonth, ...input },
          { onConflict: 'shop_id,year_month' }
        );
      if (error) throw error;
    }

    revalidatePath('/bi/kpiTarget');
    revalidatePath('/bi/flDashboard');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '保存できませんでした' };
  }
}

/** 日別売上目標の保存（仕様書 §6.7） */
export async function saveDailyTargetsAction(
  shopId: string,
  rows: { business_date: string; amount: number }[]
): Promise<ActionResult> {
  try {
    await requireTargetEdit(shopId);

    if (isDemoMode()) {
      const state = db();
      const dates = new Set(rows.map((r) => r.business_date));
      state.dailySalesTargets = [
        ...state.dailySalesTargets.filter(
          (t) => !(t.shop_id === shopId && dates.has(t.business_date))
        ),
        ...rows.map((row) => ({ shop_id: shopId, ...row })),
      ];
    } else {
      const { error } = await supabaseAdmin()
        .from('daily_sales_targets')
        .upsert(
          rows.map((row) => ({ shop_id: shopId, ...row })),
          { onConflict: 'shop_id,business_date' }
        );
      if (error) throw error;
    }

    revalidatePath('/bi/kpiTarget');
    revalidatePath('/bi/sales-analytics');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '保存できませんでした' };
  }
}
