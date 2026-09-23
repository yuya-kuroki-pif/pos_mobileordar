'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';

/**
 * 返金申請（仕様書 §5.24）。
 *
 * 決済会社の API への接続はまだなので、いまは「申請した」ことを記録するところまで。
 * 実際の返金は決済会社の管理画面で行う前提で、申請日時を残して二重申請を防ぐ。
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function requestRefundAction(paymentId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'cashless')) {
      return { ok: false, error: '返金を申請する権限がありません。' };
    }

    const now = new Date().toISOString();
    const shopIds = session.shops.map((shop) => shop.id);

    if (isDemoMode()) {
      const payment = db().terminalPayments.find((row) => row.id === paymentId);
      if (!payment) return { ok: false, error: '取引が見つかりません。' };
      if (!shopIds.includes(payment.shop_id)) {
        return { ok: false, error: 'この店舗の取引は操作できません。' };
      }
      if (payment.refund_requested_at) {
        return { ok: false, error: 'すでに返金を申請しています。' };
      }
      payment.refund_requested_at = now;
    } else {
      const { data, error } = await supabaseAdmin()
        .from('terminal_payments')
        .update({ refund_requested_at: now })
        .eq('id', paymentId)
        .in('shop_id', shopIds)
        .is('refund_requested_at', null)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        return { ok: false, error: '取引が見つからないか、すでに申請済みです。' };
      }
    }

    revalidatePath('/terminalPayment/history');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '返金を申請できませんでした' };
  }
}
