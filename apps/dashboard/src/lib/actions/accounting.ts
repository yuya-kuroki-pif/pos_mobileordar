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

export interface ItemCorrection {
  item_id: string;
  unit_price: number;
  quantity: number;
}

/**
 * 会計明細の修正（仕様書 §5.23）。
 *
 * 明細を直すと合計・消費税も変わるので、会計の金額まで引き直す。
 * 直したことは必ず重要操作履歴（audit_logs）に残す。
 */
export async function modifyAccountingAction(
  paymentId: string,
  corrections: ItemCorrection[],
  reason: string
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'accounting_history')) {
      throw new Error('会計を修正する権限がありません。');
    }
    if (corrections.length === 0) return { ok: false, error: '修正する明細がありません。' };
    if (corrections.some((row) => row.quantity < 0 || row.unit_price < 0)) {
      return { ok: false, error: '個数と価格は 0 以上にしてください。' };
    }

    if (isDemoMode()) {
      const state = db();
      const payment = state.paymentRecords.find((p) => p.id === paymentId);
      if (!payment) return { ok: false, error: '会計が見つかりません。' };
      if (payment.voided_at) return { ok: false, error: '取り消された会計は修正できません。' };
      if (!session.shops.some((shop) => shop.id === payment.store_id)) {
        return { ok: false, error: 'この店舗を操作する権限がありません。' };
      }

      const before = payment.total;

      for (const correction of corrections) {
        const item = state.orderItemRecords.find(
          (row) => row.id === correction.item_id && row.session_id === payment.session_id
        );
        if (!item) continue;
        item.unit_price = Math.round(correction.unit_price);
        item.quantity = Math.round(correction.quantity);
        item.line_total = item.unit_price * item.quantity;
      }

      // 明細から会計の金額を引き直す
      const items = state.orderItemRecords.filter((row) => row.session_id === payment.session_id);
      const subtotal = items.reduce((sum, row) => sum + row.line_total, 0);
      payment.subtotal = subtotal;
      payment.tax = items.reduce(
        (sum, row) => sum + Math.round((row.line_total * row.tax_rate) / (1 + row.tax_rate)),
        0
      );
      payment.total = subtotal - payment.discount + payment.service_charge;
      payment.modified_at = new Date().toISOString();

      state.auditLogs.push({
        id: `${paymentId}-modify-${Date.now()}`,
        shop_id: payment.store_id,
        event_type: 'accounting_modify',
        occurred_at: payment.modified_at,
        table_id: null,
        clerk_id: payment.clerk_id,
        amount: payment.total - before,
        receipt_number: payment.receipt_number,
        note: reason,
      });
    } else {
      const supabase = supabaseAdmin();

      const { data } = await supabase
        .from('payments')
        .select('store_id, session_id, total, discount, service_charge, receipt_number, clerk_id, voided_at')
        .eq('id', paymentId)
        .maybeSingle();

      const payment = data as {
        store_id: string;
        session_id: string;
        total: number;
        discount: number;
        service_charge: number;
        receipt_number: number | null;
        clerk_id: string | null;
        voided_at: string | null;
      } | null;
      if (!payment) return { ok: false, error: '会計が見つかりません。' };
      if (payment.voided_at) return { ok: false, error: '取り消された会計は修正できません。' };
      if (!session.shops.some((shop) => shop.id === payment.store_id)) {
        return { ok: false, error: 'この店舗を操作する権限がありません。' };
      }

      for (const correction of corrections) {
        const { error } = await supabase
          .from('order_items')
          .update({
            unit_price: Math.round(correction.unit_price),
            quantity: Math.round(correction.quantity),
          })
          .eq('id', correction.item_id)
          .eq('session_id', payment.session_id);
        if (error) throw error;
      }

      // line_total は生成列なので、読み直してから会計を引き直す
      const { data: itemData, error: itemError } = await supabase
        .from('order_items')
        .select('line_total, tax_rate')
        .eq('session_id', payment.session_id);
      if (itemError) throw itemError;

      const items = (itemData ?? []) as { line_total: number; tax_rate: number }[];
      const subtotal = items.reduce((sum, row) => sum + row.line_total, 0);
      const tax = items.reduce(
        (sum, row) => sum + Math.round((row.line_total * row.tax_rate) / (1 + row.tax_rate)),
        0
      );
      const total = subtotal - payment.discount + payment.service_charge;

      const { error } = await supabase
        .from('payments')
        .update({ subtotal, tax, total, modified_at: new Date().toISOString() })
        .eq('id', paymentId);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        shop_id: payment.store_id,
        event_type: 'accounting_modify',
        amount: total - payment.total,
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
    return { ok: false, error: message || '修正できませんでした' };
  }
}
