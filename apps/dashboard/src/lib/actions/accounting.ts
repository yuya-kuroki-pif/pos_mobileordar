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

/**
 * 会計の取消（仕様書 §5.23）。
 * 取り消したことは必ず重要操作履歴（audit_logs）に残す。
 */
export async function voidAccountingAction(
  paymentId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'accounting_history')) {
      throw new Error('会計を取り消す権限がありません。');
    }

    if (isDemoMode()) {
      const state = db();
      const payment = state.paymentRecords.find((p) => p.id === paymentId);
      if (!payment) return { ok: false, error: '会計が見つかりません。' };
      if (!session.shops.some((shop) => shop.id === payment.store_id)) {
        return { ok: false, error: 'この店舗を操作する権限がありません。' };
      }

      payment.voided_at = new Date().toISOString();
      payment.void_reason = reason;
      payment.status = 'refunded';

      state.auditLogs.push({
        id: `${paymentId}-void`,
        shop_id: payment.store_id,
        event_type: 'void',
        occurred_at: payment.voided_at,
        table_id: null,
        clerk_id: payment.clerk_id,
        amount: payment.total,
        receipt_number: payment.receipt_number,
        note: reason,
      });
    } else {
      const supabase = supabaseAdmin();

      const { data } = await supabase
        .from('payments')
        .select('store_id, total, receipt_number, clerk_id')
        .eq('id', paymentId)
        .maybeSingle();

      const payment = data as {
        store_id: string;
        total: number;
        receipt_number: number | null;
        clerk_id: string | null;
      } | null;
      if (!payment) return { ok: false, error: '会計が見つかりません。' };
      if (!session.shops.some((shop) => shop.id === payment.store_id)) {
        return { ok: false, error: 'この店舗を操作する権限がありません。' };
      }

      const { error } = await supabase.rpc('void_payment', {
        p_payment_id: paymentId,
        p_reason: reason,
      });
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        shop_id: payment.store_id,
        event_type: 'void',
        amount: payment.total,
        receipt_number: payment.receipt_number,
        clerk_id: payment.clerk_id,
        note: reason,
      });
    }

    revalidatePath('/accounting/history');
    revalidatePath(`/accounting/history/${paymentId}`);
    revalidatePath('/auditLogs');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '取り消せませんでした' };
  }
}
