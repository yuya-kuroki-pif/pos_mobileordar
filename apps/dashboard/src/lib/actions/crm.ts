'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { CouponKind } from '../types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

async function requireCrmEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'crm')) {
    throw new Error('CRM を編集する権限がありません。');
  }
  return session;
}

export interface CouponInput {
  id: string;
  kind: CouponKind;
  name: string;
  display_name: string;
  content: string;
  description: string;
  terms: string;
  starts_at: string | null;
  ends_at: string | null;
  valid_days: number | null;
}

/** クーポンの追加・更新（仕様書 §5.30） */
export async function saveCouponAction(input: CouponInput): Promise<ActionResult> {
  try {
    const session = await requireCrmEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: 'クーポン管理名を入力してください。' };

    const payload = {
      kind: input.kind,
      name,
      display_name: input.display_name.trim() || name,
      content: input.content.trim() || null,
      description: input.description.trim() || null,
      terms: input.terms.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      valid_days: input.valid_days,
    };

    let id = input.id;

    if (isDemoMode()) {
      const state = db();
      const existing = state.coupons.find((c) => c.id === id);
      if (existing) Object.assign(existing, payload);
      else {
        id = `coupon-${Math.random().toString(36).slice(2, 10)}`;
        state.coupons.push({
          id,
          company_id: companyId,
          image_url: null,
          discount_type_id: null,
          menu_id: null,
          ...payload,
        });
      }
    } else {
      const supabase = supabaseAdmin();
      if (id) {
        const { error } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', id)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('coupons')
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }
    }

    revalidatePath('/coupon');
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

/** クーポン自動配信の設定（仕様書 §5.31） */
export async function saveCouponPresetAction(
  segment: string,
  enabled: boolean,
  couponId: string | null
): Promise<ActionResult> {
  try {
    const session = await requireCrmEdit();
    const companyId = session.currentCompanyId;

    if (isDemoMode()) {
      const state = db();
      const existing = state.couponPresets.find(
        (p) => p.company_id === companyId && p.segment === segment
      );
      if (existing) {
        existing.enabled = enabled;
        existing.coupon_id = couponId;
      } else
        state.couponPresets.push({
          id: `preset-${Math.random().toString(36).slice(2, 10)}`,
          company_id: companyId,
          segment,
          enabled,
          coupon_id: couponId,
        });
    } else {
      const { error } = await supabaseAdmin()
        .from('coupon_presets')
        .upsert(
          { company_id: companyId, segment, enabled, coupon_id: couponId },
          { onConflict: 'company_id,segment' }
        );
      if (error) throw error;
    }

    revalidatePath('/crm/couponPresets');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** モバイルオーダーアンケートの店舗設定（仕様書 §5.31） */
export async function setShopQuestionnaireAction(
  shopId: string,
  patch: { menu_review_enabled?: boolean; staff_review_enabled?: boolean }
): Promise<ActionResult> {
  try {
    const session = await requireCrmEdit();
    if (!session.shops.some((shop) => shop.id === shopId)) {
      return { ok: false, error: 'この店舗を編集する権限がありません。' };
    }

    if (isDemoMode()) {
      const state = db();
      const existing = state.shopQuestionnaireSettings.find((s) => s.shop_id === shopId);
      if (existing) Object.assign(existing, patch);
      else
        state.shopQuestionnaireSettings.push({
          shop_id: shopId,
          menu_review_enabled: false,
          staff_review_enabled: false,
          ...patch,
        });
    } else {
      const { error } = await supabaseAdmin()
        .from('shop_questionnaire_settings')
        .upsert({ shop_id: shopId, ...patch }, { onConflict: 'shop_id' });
      if (error) throw error;
    }

    revalidatePath('/questionnaire');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
