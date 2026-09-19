'use server';

import { revalidatePath } from 'next/cache';

import { getStaffSession } from '../auth';
import * as demo from '../demo/repo';
import { getOpenSessionForTable, getStoreById, getTableByToken } from '../queries';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { OrderChannel, OrderItemStatus, PaymentMethod } from '../types';

/** 注文 1 行ぶんの入力。価格はサーバー側で引き直すため送らせない */
export interface OrderLineInput {
  menu_item_id: string;
  quantity: number;
  option_ids: string[];
  note?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** 呼び出し側で使う任意の戻り値（会計 ID など） */
  id?: string;
}

/** Postgres から返るエラーは技術的すぎるので、利用者に見せる文言へ寄せる */
function toMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  // RAISE EXCEPTION のメッセージはそのまま日本語で書いてあるので活かす
  return raw.replace(/^.*?:\s*/, '').trim() || '処理に失敗しました';
}

// ===========================================================================
// 顧客向け（QR トークンで認可）
// ===========================================================================

/**
 * QR を読み込んだ客が「注文をはじめる」を押したときに呼ぶ。
 * すでに卓が開いていればそのセッションに合流する。
 */
export async function startSession(token: string, guestCount: number): Promise<ActionResult> {
  try {
    const table = await getTableByToken(token);
    if (!table) return { ok: false, error: 'この QR コードは無効です。店員にお声がけください。' };

    const sessionId = await openSession(table.id, guestCount);

    revalidatePath(`/order/${token}`);
    return { ok: true, id: sessionId };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** モバイルオーダーからの注文確定 */
export async function placeMobileOrder(
  token: string,
  lines: OrderLineInput[],
  note?: string
): Promise<ActionResult> {
  try {
    const table = await getTableByToken(token);
    if (!table) return { ok: false, error: 'この QR コードは無効です。' };

    // 店舗がモバイルオーダーを閉じている場合は受け付けない
    const store = await getStoreById(table.store_id);
    if (store && !store.mobile_order_open) {
      return { ok: false, error: '現在モバイルオーダーの受付を停止しています。店員にお声がけください。' };
    }

    const session = await getOpenSessionForTable(table.id);
    if (!session) {
      return { ok: false, error: 'ご利用中の情報が見つかりません。もう一度 QR を読み込んでください。' };
    }

    const result = await insertOrder(session.id, 'mobile', lines, note);
    if (!result.ok) return result;

    revalidatePath(`/order/${token}`);
    return result;
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** 客からの「お会計をお願いします」 */
export async function requestBill(token: string): Promise<ActionResult> {
  try {
    const table = await getTableByToken(token);
    if (!table) return { ok: false, error: 'この QR コードは無効です。' };

    const session = await getOpenSessionForTable(table.id);
    if (!session) return { ok: false, error: 'ご利用中の情報が見つかりません。' };

    if (isDemoMode()) {
      demo.requestBill(session.id);
    } else {
      const { error } = await supabaseAdmin()
        .from('table_sessions')
        .update({ status: 'bill_requested' })
        .eq('id', session.id)
        .eq('status', 'open');
      if (error) throw error;
    }

    revalidatePath(`/order/${token}`);
    revalidatePath('/pos');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

// ===========================================================================
// スタッフ向け（PIN セッションで認可）
// ===========================================================================

/** スタッフ操作の共通ガード。ログインしていなければ操作対象の店舗 ID を返さない */
async function requireStoreId(): Promise<string> {
  const session = await getStaffSession();
  if (!session) throw new Error('ログインの有効期限が切れました。再度ログインしてください。');
  return session.storeId;
}

/** POS から卓を開ける */
export async function openTable(tableId: string, guestCount: number): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();

    if (!isDemoMode()) {
      // 他店舗の卓を開けられないよう確認する
      const { data: table } = await supabaseAdmin()
        .from('restaurant_tables')
        .select('id')
        .eq('id', tableId)
        .eq('store_id', storeId)
        .maybeSingle();
      if (!table) return { ok: false, error: '卓が見つかりません。' };
    }

    const sessionId = await openSession(tableId, guestCount);

    revalidatePath('/pos');
    return { ok: true, id: sessionId };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** POS からの注文入力 */
export async function placePosOrder(
  sessionId: string,
  lines: OrderLineInput[],
  note?: string
): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    await assertSessionInStore(sessionId, storeId);

    const result = await insertOrder(sessionId, 'pos', lines, note);
    if (!result.ok) return result;

    revalidatePath('/pos');
    revalidatePath(`/pos/session/${sessionId}`);
    return result;
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** KDS / POS からの調理ステータス更新 */
export async function updateItemStatus(
  itemId: string,
  status: OrderItemStatus
): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();

    if (isDemoMode()) {
      demo.updateItemStatus(itemId, status);
    } else {
      const { error } = await supabaseAdmin()
        .from('order_items')
        .update({ status })
        .eq('id', itemId)
        .eq('store_id', storeId);
      if (error) throw error;
    }

    revalidatePath('/kds');
    revalidatePath('/pos');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** 明細の数量変更。0 を指定した場合はキャンセル扱いにする */
export async function updateItemQuantity(
  itemId: string,
  quantity: number
): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();

    if (isDemoMode()) {
      demo.updateItemQuantity(itemId, quantity);
    } else {
      const patch =
        quantity <= 0
          ? { status: 'cancelled' as OrderItemStatus }
          : { quantity: Math.floor(quantity) };

      const { error } = await supabaseAdmin()
        .from('order_items')
        .update(patch)
        .eq('id', itemId)
        .eq('store_id', storeId);
      if (error) throw error;
    }

    revalidatePath('/pos');
    revalidatePath('/kds');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** 会計する。mock 決済（実際の決済連携は行わず、記録のみ） */
export async function checkout(
  sessionId: string,
  method: PaymentMethod,
  discount: number,
  received: number,
  note?: string
): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    await assertSessionInStore(sessionId, storeId);

    const safeDiscount = Math.max(0, Math.floor(discount));
    const safeReceived = Math.max(0, Math.floor(received));

    let paymentId: string;
    if (isDemoMode()) {
      paymentId = demo.checkoutSession(sessionId, method, safeDiscount, safeReceived);
    } else {
      const { data, error } = await supabaseAdmin().rpc('checkout_session', {
        p_session_id: sessionId,
        p_method: method,
        p_discount: safeDiscount,
        p_received: safeReceived,
        p_note: note ?? null,
      });
      if (error) throw error;
      paymentId = data as string;
    }

    revalidatePath('/pos');
    revalidatePath('/admin');
    return { ok: true, id: paymentId };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** 卓の人数を変更する */
export async function updateGuestCount(
  sessionId: string,
  guestCount: number
): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    await assertSessionInStore(sessionId, storeId);

    if (isDemoMode()) {
      demo.updateGuestCount(sessionId, guestCount);
    } else {
      const { error } = await supabaseAdmin()
        .from('table_sessions')
        .update({ guest_count: Math.max(1, Math.floor(guestCount)) })
        .eq('id', sessionId);
      if (error) throw error;
    }

    revalidatePath('/pos');
    revalidatePath(`/pos/session/${sessionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

/** 誤って開けた卓を取り消す（注文が入っていない場合のみ） */
export async function cancelSession(sessionId: string): Promise<ActionResult> {
  try {
    const storeId = await requireStoreId();
    await assertSessionInStore(sessionId, storeId);

    if (isDemoMode()) {
      demo.cancelSession(sessionId);
    } else {
      const db = supabaseAdmin();

      const { count } = await db
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .neq('status', 'cancelled');

      if ((count ?? 0) > 0) {
        return { ok: false, error: '注文が入っているため取り消せません。会計を行ってください。' };
      }

      const { error } = await db
        .from('table_sessions')
        .update({ status: 'cancelled', closed_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (error) throw error;
    }

    revalidatePath('/pos');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

// ===========================================================================
// 内部ヘルパー
// ===========================================================================

async function openSession(tableId: string, guestCount: number): Promise<string> {
  if (isDemoMode()) return demo.openTableSession(tableId, guestCount);

  const { data, error } = await supabaseAdmin().rpc('open_table_session', {
    p_table_id: tableId,
    p_guest_count: guestCount,
  });
  if (error) throw error;
  return data as string;
}

async function insertOrder(
  sessionId: string,
  channel: OrderChannel,
  lines: OrderLineInput[],
  note?: string
): Promise<ActionResult> {
  const items = lines
    .filter((line) => line.menu_item_id && line.quantity > 0)
    .map((line) => ({
      menu_item_id: line.menu_item_id,
      quantity: Math.floor(line.quantity),
      option_ids: line.option_ids ?? [],
      note: line.note ?? null,
    }));

  if (items.length === 0) return { ok: false, error: '注文内容が空です。' };

  let orderId: string;
  if (isDemoMode()) {
    orderId = demo.placeOrder(sessionId, channel, items);
  } else {
    const { data, error } = await supabaseAdmin().rpc('place_order', {
      p_session_id: sessionId,
      p_channel: channel,
      p_items: items,
      p_note: note ?? null,
    });
    if (error) throw error;
    orderId = data as string;
  }

  revalidatePath('/kds');
  return { ok: true, id: orderId };
}

/** セッションが自店舗のものであることを確認する */
async function assertSessionInStore(sessionId: string, storeId: string): Promise<void> {
  if (isDemoMode()) {
    const session = demo.getSession(sessionId);
    if (!session || session.store_id !== storeId) throw new Error('対象の卓が見つかりません。');
    return;
  }

  const { data } = await supabaseAdmin()
    .from('table_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('store_id', storeId)
    .maybeSingle();
  if (!data) throw new Error('対象の卓が見つかりません。');
}
