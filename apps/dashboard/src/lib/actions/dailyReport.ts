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

/** 日報のコメント（仕様書 §6.3） */
export async function saveDailyReportAction(
  shopId: string,
  businessDate: string,
  comment: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'analytics')) {
      throw new Error('日報を編集する権限がありません。');
    }
    if (!session.shops.some((shop) => shop.id === shopId)) {
      return { ok: false, error: 'この店舗を編集する権限がありません。' };
    }

    if (isDemoMode()) {
      const state = db();
      const existing = state.dailyReports.find(
        (r) => r.shop_id === shopId && r.business_date === businessDate
      );
      if (existing) existing.comment = comment;
      else
        state.dailyReports.push({
          id: `${shopId}-${businessDate}`,
          shop_id: shopId,
          business_date: businessDate,
          weather: null,
          comment,
        });
    } else {
      const { error } = await supabaseAdmin()
        .from('daily_reports')
        .upsert(
          {
            shop_id: shopId,
            business_date: businessDate,
            comment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'shop_id,business_date' }
        );
      if (error) throw error;
    }

    revalidatePath('/bi/dailySalesReport');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '保存できませんでした' };
  }
}
