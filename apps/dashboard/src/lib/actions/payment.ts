'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { PaymentKind } from '../types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

async function requirePaymentEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'payment_settings')) {
    throw new Error('支払方法等設定を編集する権限がありません。');
  }
  return session;
}

function tempId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 支払方法の追加・更新（仕様書 §5.10） */
export async function savePaymentMethodAction(input: {
  id: string;
  name: string;
  kind: PaymentKind;
  display_order: number;
}): Promise<ActionResult> {
  try {
    const session = await requirePaymentEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: '支払方法名を入力してください。' };

    const payload = { name, kind: input.kind, display_order: input.display_order };
    let id = input.id;

    if (isDemoMode()) {
      const state = db();
      const existing = state.paymentMethods.find((m) => m.id === id);
      if (existing) Object.assign(existing, payload);
      else {
        id = tempId('pm');
        state.paymentMethods.push({ id, company_id: companyId, is_system: false, ...payload });
      }
    } else {
      const supabase = supabaseAdmin();
      if (id) {
        const { error } = await supabase
          .from('payment_methods')
          .update(payload)
          .eq('id', id)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('payment_methods')
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }
    }

    revalidatePath('/paymentTypes');
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

/** 支払方法の削除。システム既定（現金・オンライン決済）は消せない */
export async function deletePaymentMethodAction(id: string): Promise<ActionResult> {
  try {
    const session = await requirePaymentEdit();

    if (isDemoMode()) {
      const state = db();
      const row = state.paymentMethods.find((m) => m.id === id);
      if (!row) return { ok: false, error: '支払方法が見つかりません。' };
      if (row.is_system) return { ok: false, error: 'システム既定の支払方法は削除できません。' };
      state.paymentMethods = state.paymentMethods.filter((m) => m.id !== id);
      // 対応づけていた端末側は未設定に戻す
      for (const terminal of state.terminalPaymentMethods) {
        if (terminal.payment_method_id === id) terminal.payment_method_id = null;
      }
    } else {
      const supabase = supabaseAdmin();
      const { data } = await supabase
        .from('payment_methods')
        .select('is_system')
        .eq('id', id)
        .maybeSingle();

      if (!data) return { ok: false, error: '支払方法が見つかりません。' };
      if ((data as { is_system: boolean }).is_system) {
        return { ok: false, error: 'システム既定の支払方法は削除できません。' };
      }

      // terminal_payment_methods.payment_method_id は on delete set null
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id)
        .eq('company_id', session.currentCompanyId);
      if (error) throw error;
    }

    revalidatePath('/paymentTypes');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 割引方法と媒体は「名前だけの一覧」で形が同じなので、まとめて扱う */
export type NameListKind = 'discount' | 'inflow';

const NAME_LIST = {
  discount: { table: 'discount_types', label: '割引方法', prefix: 'dt' },
  inflow: { table: 'inflow_sources', label: '媒体', prefix: 'is' },
} as const;

function demoNameList(kind: NameListKind) {
  const state = db();
  return kind === 'discount' ? state.discountTypes : state.inflowSources;
}

export async function saveNameListAction(
  kind: NameListKind,
  input: { id: string; name: string; display_order: number }
): Promise<ActionResult> {
  try {
    const session = await requirePaymentEdit();
    const companyId = session.currentCompanyId;
    const meta = NAME_LIST[kind];

    const name = input.name.trim();
    if (!name) return { ok: false, error: `${meta.label}名を入力してください。` };

    const payload = { name, display_order: input.display_order };
    let id = input.id;

    if (isDemoMode()) {
      const rows = demoNameList(kind);
      const existing = rows.find((r) => r.id === id);
      if (existing) Object.assign(existing, payload);
      else {
        id = tempId(meta.prefix);
        rows.push({ id, company_id: companyId, is_system: false, ...payload });
      }
    } else {
      const supabase = supabaseAdmin();
      if (id) {
        const { error } = await supabase
          .from(meta.table)
          .update(payload)
          .eq('id', id)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from(meta.table)
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }
    }

    revalidatePath('/paymentTypes');
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteNameListAction(
  kind: NameListKind,
  id: string
): Promise<ActionResult> {
  try {
    const session = await requirePaymentEdit();
    const meta = NAME_LIST[kind];

    if (isDemoMode()) {
      const rows = demoNameList(kind);
      const row = rows.find((r) => r.id === id);
      if (!row) return { ok: false, error: `${meta.label}が見つかりません。` };
      if (row.is_system) return { ok: false, error: `システム既定の${meta.label}は削除できません。` };

      const state = db();
      if (kind === 'discount') state.discountTypes = rows.filter((r) => r.id !== id);
      else state.inflowSources = rows.filter((r) => r.id !== id);
    } else {
      const supabase = supabaseAdmin();
      const { data } = await supabase
        .from(meta.table)
        .select('is_system')
        .eq('id', id)
        .maybeSingle();

      if (!data) return { ok: false, error: `${meta.label}が見つかりません。` };
      if ((data as { is_system: boolean }).is_system) {
        return { ok: false, error: `システム既定の${meta.label}は削除できません。` };
      }

      const { error } = await supabase
        .from(meta.table)
        .delete()
        .eq('id', id)
        .eq('company_id', session.currentCompanyId);
      if (error) throw error;
    }

    revalidatePath('/paymentTypes');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * キャッシュレス端末支払方法（仕様書 §5.10）。
 * 決済端末が返すブランド名と、支払方法の対応づけをまとめて置き換える。
 */
export async function saveTerminalPaymentMethodsAction(
  rows: { id: string; brand: string; payment_method_id: string | null }[]
): Promise<ActionResult> {
  try {
    const session = await requirePaymentEdit();
    const companyId = session.currentCompanyId;

    const brands = rows.map((row) => row.brand.trim());
    if (brands.some((brand) => !brand)) {
      return { ok: false, error: 'ブランド名を入力してください。' };
    }
    if (new Set(brands).size !== brands.length) {
      return { ok: false, error: '同じブランド名が複数あります。' };
    }

    if (isDemoMode()) {
      const state = db();
      state.terminalPaymentMethods = [
        ...state.terminalPaymentMethods.filter((t) => t.company_id !== companyId),
        ...rows.map((row, index) => ({
          id: row.id.startsWith('tmp-') ? tempId('tp') : row.id,
          company_id: companyId,
          brand: row.brand.trim(),
          payment_method_id: row.payment_method_id,
          display_order: (index + 1) * 10,
        })),
      ];
    } else {
      const supabase = supabaseAdmin();
      await supabase.from('terminal_payment_methods').delete().eq('company_id', companyId);

      if (rows.length > 0) {
        const { error } = await supabase.from('terminal_payment_methods').insert(
          rows.map((row, index) => ({
            company_id: companyId,
            brand: row.brand.trim(),
            payment_method_id: row.payment_method_id,
            display_order: (index + 1) * 10,
          }))
        );
        if (error) throw error;
      }
    }

    revalidatePath('/paymentTypes');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
