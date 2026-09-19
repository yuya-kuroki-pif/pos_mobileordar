'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type {
  AutoTranslationSetting,
  CashChangerSetting,
  CompulsoryAppetizer,
  MobileOrderDesign,
} from '../types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

async function requireCompanyEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'company_management')) {
    throw new Error('業態の設定を編集する権限がありません。');
  }
  return session;
}

/** 業態の追加・改名（仕様書 §5.9） */
export async function saveCompanyAction(
  id: string,
  name: string,
  displayOrder: number
): Promise<ActionResult> {
  try {
    const session = await requireCompanyEdit();

    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: '業態名を入力してください。' };

    let companyId = id;
    const payload = { name: trimmed, display_order: displayOrder };

    if (isDemoMode()) {
      const state = db();
      const existing = state.companies.find((c) => c.id === companyId);
      if (existing) Object.assign(existing, payload);
      else {
        companyId = `company-${Math.random().toString(36).slice(2, 8)}`;
        state.companies.push({
          id: companyId,
          corporation_id: session.corporation.id,
          ...payload,
        });
      }
    } else {
      const supabase = supabaseAdmin();
      if (companyId) {
        const { error } = await supabase
          .from('companies')
          .update(payload)
          .eq('id', companyId)
          .eq('corporation_id', session.corporation.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('companies')
          .insert({ corporation_id: session.corporation.id, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        companyId = (data as { id: string }).id;

        // 新しい業態にも支払方法などの既定値を入れておく（§5.10）
        await supabase.rpc('seed_default_payment_settings', { p_company_id: companyId });
      }
    }

    revalidatePath('/company');
    revalidatePath('/', 'layout');
    return { ok: true, id: companyId };
  } catch (error) {
    return fail(error);
  }
}

/** 自動翻訳設定の保存（仕様書 §5.9） */
export async function saveAutoTranslationAction(
  input: Omit<AutoTranslationSetting, 'company_id'>
): Promise<ActionResult> {
  try {
    const session = await requireCompanyEdit();
    const companyId = session.currentCompanyId;

    if (isDemoMode()) {
      const state = db();
      const existing = state.autoTranslationSettings.find((s) => s.company_id === companyId);
      if (existing) Object.assign(existing, input);
      else state.autoTranslationSettings.push({ company_id: companyId, ...input });
    } else {
      const { error } = await supabaseAdmin()
        .from('auto_translation_settings')
        .upsert({ company_id: companyId, ...input, updated_at: new Date().toISOString() });
      if (error) throw error;
    }

    revalidatePath('/autoTranslation');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** モバイルオーダーデザイン設定の保存（仕様書 §5.11） */
export async function saveMobileOrderDesignAction(
  input: Omit<MobileOrderDesign, 'company_id'>
): Promise<ActionResult> {
  try {
    const session = await requireCompanyEdit();
    const companyId = session.currentCompanyId;

    if (isDemoMode()) {
      const state = db();
      const existing = state.mobileOrderDesigns.find((d) => d.company_id === companyId);
      if (existing) Object.assign(existing, input);
      else state.mobileOrderDesigns.push({ company_id: companyId, ...input });
    } else {
      const { error } = await supabaseAdmin()
        .from('mobile_order_designs')
        .upsert({ company_id: companyId, ...input, updated_at: new Date().toISOString() });
      if (error) throw error;
    }

    revalidatePath('/mobileOrderDesign/theme');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 自動釣銭機設定の保存（仕様書 §5.9）。店舗 1 つぶん */
export async function saveCashChangerAction(
  shopId: string,
  patch: Partial<Omit<CashChangerSetting, 'shop_id'>>
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'shop_management')) {
      throw new Error('自動釣銭機の設定を編集する権限がありません。');
    }
    if (!session.shops.some((shop) => shop.id === shopId)) {
      throw new Error('この店舗を編集する権限がありません。');
    }

    if (isDemoMode()) {
      const state = db();
      const existing = state.cashChangerSettings.find((s) => s.shop_id === shopId);
      if (existing) Object.assign(existing, patch);
      else
        state.cashChangerSettings.push({
          shop_id: shopId,
          keep_float_in_changer: false,
          allow_external_deposit: false,
          allow_emergency_cash: false,
          ...patch,
        });
    } else {
      const { error } = await supabaseAdmin()
        .from('cash_changer_settings')
        .upsert({ shop_id: shopId, ...patch }, { onConflict: 'shop_id' });
      if (error) throw error;
    }

    revalidatePath('/cashChanger');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** お通しの追加・更新（仕様書 §5.9） */
export async function saveAppetizerAction(
  input: Omit<CompulsoryAppetizer, 'company_id'>
): Promise<ActionResult> {
  try {
    const session = await requireCompanyEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: '設定名を入力してください。' };
    if (input.end_min <= input.start_min) {
      return { ok: false, error: '終了時間は開始時間より後にしてください（翌 1:00 なら 25:00）。' };
    }

    const payload = {
      name,
      menu_id: input.menu_id,
      price: Math.max(0, Math.round(input.price)),
      start_min: input.start_min,
      end_min: input.end_min,
      display_order: input.display_order,
    };

    let id = input.id;

    if (isDemoMode()) {
      const state = db();
      const existing = state.compulsoryAppetizers.find((a) => a.id === id);
      if (existing) Object.assign(existing, payload);
      else {
        id = `ap-${Math.random().toString(36).slice(2, 10)}`;
        state.compulsoryAppetizers.push({ id, company_id: companyId, ...payload });
      }
    } else {
      const supabase = supabaseAdmin();
      if (id) {
        const { error } = await supabase
          .from('compulsory_appetizers')
          .update(payload)
          .eq('id', id)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('compulsory_appetizers')
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }
    }

    revalidatePath('/menu/autoCompulsoryAppetizer');
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAppetizerAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireCompanyEdit();

    if (isDemoMode()) {
      const state = db();
      state.compulsoryAppetizers = state.compulsoryAppetizers.filter((a) => a.id !== id);
      state.shopAppetizers = state.shopAppetizers.filter((l) => l.appetizer_id !== id);
    } else {
      const { error } = await supabaseAdmin()
        .from('compulsory_appetizers')
        .delete()
        .eq('id', id)
        .eq('company_id', session.currentCompanyId);
      if (error) throw error;
    }

    revalidatePath('/menu/autoCompulsoryAppetizer');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 店舗ごとの自動注文 ON/OFF（仕様書 §5.9） */
export async function setShopAppetizerAction(
  shopId: string,
  appetizerId: string,
  isAutoOrder: boolean
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'company_management')) {
      throw new Error('お通しの設定を編集する権限がありません。');
    }
    if (!session.shops.some((shop) => shop.id === shopId)) {
      throw new Error('この店舗を編集する権限がありません。');
    }

    if (isDemoMode()) {
      const state = db();
      const existing = state.shopAppetizers.find(
        (l) => l.shop_id === shopId && l.appetizer_id === appetizerId
      );
      if (existing) existing.is_auto_order = isAutoOrder;
      else
        state.shopAppetizers.push({
          shop_id: shopId,
          appetizer_id: appetizerId,
          is_auto_order: isAutoOrder,
        });
    } else {
      const { error } = await supabaseAdmin()
        .from('shop_appetizers')
        .upsert(
          { shop_id: shopId, appetizer_id: appetizerId, is_auto_order: isAutoOrder },
          { onConflict: 'shop_id,appetizer_id' }
        );
      if (error) throw error;
    }

    revalidatePath('/menu/autoCompulsoryAppetizer');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
