'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { DeliveryStatus, DeliveryTarget, MessagingChannel } from '../types';

/**
 * メッセージ配信の編集（仕様書 §5.29）。
 *
 * ここで作るのは「いつ・誰に・何を送るか」の予約まで。
 * 実際に LINE / Zalo へ投げるのは配信サービスとの接続後で、
 * それまでは予約されたまま送られない。画面にもそう書いてある。
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface DeliveryContentInput {
  kind: 'text' | 'image' | 'coupon' | 'questionnaire';
  body: string;
  image_url: string | null;
  link_url: string | null;
  notify_text: string;
}

export interface DeliveryFilter extends Record<string, unknown> {
  visitCountFrom?: number;
  visitCountTo?: number;
  daysSinceVisitFrom?: number;
  daysSinceVisitTo?: number;
  gender?: string;
  ageFrom?: number;
  ageTo?: number;
  shopIds?: string[];
  excludeRecentDays?: number;
}

export interface DeliveryInput {
  id: string;
  channel: MessagingChannel;
  messaging_account_id: string | null;
  zns_template_id: string | null;
  name: string;
  status: DeliveryStatus;
  target_type: DeliveryTarget;
  filter: DeliveryFilter;
  max_count: number | null;
  scheduled_at: string | null;
  repeat_daily: boolean;
  contents: DeliveryContentInput[];
}

async function requireCrmEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'crm')) {
    throw new Error('配信を編集する権限がありません。');
  }
  return session;
}

/** 条件に当てはまるお客様が何人いるかを数える（§5.29 の「対象者数を更新」） */
export async function countDeliveryTargetsAction(
  targetType: DeliveryTarget,
  filter: DeliveryFilter
): Promise<{ ok: boolean; error?: string; count?: number }> {
  try {
    const session = await requireSession();

    if (isDemoMode()) {
      const customers = db().customers.filter((c) => c.corporation_id === session.corporation.id);
      if (targetType !== 'filtered') return { ok: true, count: customers.length };

      const today = Date.now();
      const matched = customers.filter((customer) => {
        if (filter.visitCountFrom && customer.visit_count < filter.visitCountFrom) return false;
        if (filter.visitCountTo && customer.visit_count > filter.visitCountTo) return false;

        if (filter.daysSinceVisitFrom || filter.daysSinceVisitTo) {
          const days = Math.floor((today - Date.parse(customer.last_visit_at ?? '')) / 86400000);
          if (Number.isNaN(days)) return false;
          if (filter.daysSinceVisitFrom && days < filter.daysSinceVisitFrom) return false;
          if (filter.daysSinceVisitTo && days > filter.daysSinceVisitTo) return false;
        }

        if (filter.gender && filter.gender !== 'all' && customer.gender !== filter.gender) {
          return false;
        }

        if (filter.ageFrom || filter.ageTo) {
          const birth = Date.parse(customer.birth_date ?? '');
          if (Number.isNaN(birth)) return false;
          const age = Math.floor((today - birth) / (365.25 * 86400000));
          if (filter.ageFrom && age < filter.ageFrom) return false;
          if (filter.ageTo && age > filter.ageTo) return false;
        }

        return true;
      });

      return { ok: true, count: matched.length };
    }

    let query = supabaseAdmin()
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('corporation_id', session.corporation.id);

    if (targetType === 'filtered') {
      if (filter.visitCountFrom) query = query.gte('visit_count', filter.visitCountFrom);
      if (filter.visitCountTo) query = query.lte('visit_count', filter.visitCountTo);
      if (filter.gender && filter.gender !== 'all') query = query.eq('gender', filter.gender);

      const daysAgo = (days: number) =>
        new Date(Date.now() - days * 86400000).toISOString();
      if (filter.daysSinceVisitFrom) {
        query = query.lte('last_visit_at', daysAgo(filter.daysSinceVisitFrom));
      }
      if (filter.daysSinceVisitTo) {
        query = query.gte('last_visit_at', daysAgo(filter.daysSinceVisitTo));
      }
    }

    const { count, error } = await query;
    if (error) throw error;
    return { ok: true, count: count ?? 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '対象者数を数えられませんでした' };
  }
}

/** 配信の保存（新規・更新）。本文は貼り直す */
export async function saveDeliveryAction(input: DeliveryInput): Promise<ActionResult> {
  try {
    const session = await requireCrmEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: '配信管理名を入力してください。' };
    if (input.contents.length === 0) {
      return { ok: false, error: 'メッセージを 1 つ以上入れてください。' };
    }
    if (input.contents.some((row) => row.kind === 'text' && !row.body.trim())) {
      return { ok: false, error: 'テキストのメッセージが空です。' };
    }
    if (input.channel === 'zalo' && !input.zns_template_id?.trim()) {
      return { ok: false, error: 'Zalo は ZNS テンプレート ID が要ります。' };
    }

    const counted = await countDeliveryTargetsAction(input.target_type, input.filter);

    const payload = {
      channel: input.channel,
      messaging_account_id: input.messaging_account_id,
      zns_template_id: input.zns_template_id?.trim() || null,
      name,
      status: input.status,
      target_type: input.target_type,
      filter: input.filter,
      target_count: counted.count ?? 0,
      target_updated_at: new Date().toISOString(),
      max_count: input.max_count,
      scheduled_at: input.scheduled_at,
      repeat_daily: input.repeat_daily,
    };

    let id = input.id;

    if (isDemoMode()) {
      const state = db();
      const existing = state.messageDeliveries.find((row) => row.id === id);
      if (existing) {
        Object.assign(existing, payload);
      } else {
        id = `md-${Math.random().toString(36).slice(2, 10)}`;
        state.messageDeliveries.push({ id, company_id: companyId, ...payload });
      }
      // デモでは本文を保持する先が無いので、ここでは配信の設定だけ覚える
    } else {
      const supabase = supabaseAdmin();

      if (id) {
        const { error } = await supabase
          .from('message_deliveries')
          .update(payload)
          .eq('id', id)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('message_deliveries')
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }

      // 本文は差分を取らず貼り直す。順番が変わっても素直に反映される
      await supabase.from('message_delivery_contents').delete().eq('delivery_id', id);
      const { error: contentError } = await supabase.from('message_delivery_contents').insert(
        input.contents.map((row, index) => ({
          delivery_id: id,
          kind: row.kind,
          body: row.body.trim() || null,
          image_url: row.image_url,
          link_url: row.link_url?.trim() || null,
          notify_text: row.notify_text.trim() || null,
          display_order: index * 10,
        }))
      );
      if (contentError) throw contentError;
    }

    revalidatePath('/messageDelivery');
    return { ok: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '配信を保存できませんでした' };
  }
}

/** 配信の停止・複製・削除（§5.29 の一覧の操作） */
export async function setDeliveryStatusAction(
  deliveryId: string,
  status: DeliveryStatus
): Promise<ActionResult> {
  try {
    const session = await requireCrmEdit();

    if (isDemoMode()) {
      const row = db().messageDeliveries.find((d) => d.id === deliveryId);
      if (!row || row.company_id !== session.currentCompanyId) {
        return { ok: false, error: '配信が見つかりません。' };
      }
      row.status = status;
    } else {
      const { error } = await supabaseAdmin()
        .from('message_deliveries')
        .update({ status })
        .eq('id', deliveryId)
        .eq('company_id', session.currentCompanyId);
      if (error) throw error;
    }

    revalidatePath('/messageDelivery');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '状態を変えられませんでした' };
  }
}

export async function deleteDeliveryAction(deliveryId: string): Promise<ActionResult> {
  try {
    const session = await requireCrmEdit();

    if (isDemoMode()) {
      const state = db();
      const index = state.messageDeliveries.findIndex(
        (d) => d.id === deliveryId && d.company_id === session.currentCompanyId
      );
      if (index < 0) return { ok: false, error: '配信が見つかりません。' };
      state.messageDeliveries.splice(index, 1);
    } else {
      const { error } = await supabaseAdmin()
        .from('message_deliveries')
        .delete()
        .eq('id', deliveryId)
        .eq('company_id', session.currentCompanyId);
      if (error) throw error;
    }

    revalidatePath('/messageDelivery');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '配信を削除できませんでした' };
  }
}

/**
 * 試し送り（§5.29）。
 * 一斉配信の前に、自分の ID へ 1 通だけ送って見え方を確かめる。
 * 一斉配信そのものは、宛先の作り方と配信ジョブが揃ってから。
 */
export async function sendTestMessageAction(
  channel: MessagingChannel,
  recipientId: string,
  contents: DeliveryContentInput[],
  znsTemplateId: string | null
): Promise<ActionResult> {
  try {
    await requireCrmEdit();

    const target = recipientId.trim();
    if (!target) return { ok: false, error: '送り先の ID を入れてください。' };

    const { sendMessage } = await import('../messaging');
    const result = await sendMessage(
      channel,
      target,
      contents.map((row) => ({
        kind: row.kind,
        body: row.body.trim() || null,
        imageUrl: row.image_url,
        linkUrl: row.link_url?.trim() || null,
      })),
      { znsTemplateId }
    );

    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '試し送りできませんでした' };
  }
}
