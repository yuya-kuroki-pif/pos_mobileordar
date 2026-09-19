'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { MASTERS, type MasterDef } from '../masters';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

async function requireMasterEdit(def: MasterDef) {
  const session = await requireSession();
  if (!canEdit(session.permissions, def.feature)) {
    throw new Error(`${def.title}を編集する権限がありません。`);
  }
  return session;
}

function lookup(masterKey: string): MasterDef {
  const def = MASTERS[masterKey];
  if (!def) throw new Error(`未定義のマスターです: ${masterKey}`);
  return def;
}

function scopeColumn(def: MasterDef) {
  if (def.scope === 'corporation') return 'corporation_id';
  return def.scope === 'company' ? 'company_id' : 'shop_id';
}

function demoList(def: MasterDef) {
  const state = db() as unknown as Record<string, Record<string, unknown>[]>;
  return state[def.demoKey];
}

/** 定義にある列だけを取り出す。画面から余計な値が来ても無視する */
function pickFields(def: MasterDef, values: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (!(field.key in values)) continue;

    const raw = values[field.key];
    if (field.type === 'text') {
      const text = typeof raw === 'string' ? raw.trim() : '';
      payload[field.key] = text === '' ? (field.required ? '' : null) : text;
    } else if (field.type === 'number' || field.type === 'money') {
      payload[field.key] = Math.round(Number(raw) || 0);
    } else if (field.type === 'switch') {
      payload[field.key] = Boolean(raw);
    } else {
      payload[field.key] = raw === undefined || raw === '' ? null : raw;
    }
  }
  return payload;
}

/** マスター 1 行の追加・更新 */
export async function saveMasterAction(
  masterKey: string,
  scopeId: string,
  id: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const def = lookup(masterKey);
    const session = await requireMasterEdit(def);

    if (def.scope === 'shop' && !session.shops.some((shop) => shop.id === scopeId)) {
      return { ok: false, error: 'この店舗を編集する権限がありません。' };
    }
    if (def.scope === 'company' && scopeId !== session.currentCompanyId) {
      return { ok: false, error: 'この業態を編集する権限がありません。' };
    }
    if (def.scope === 'corporation' && scopeId !== session.corporation.id) {
      return { ok: false, error: 'この法人を編集する権限がありません。' };
    }

    const payload = pickFields(def, values);

    for (const field of def.fields) {
      if (field.required && !payload[field.key]) {
        return { ok: false, error: `${field.label}を入力してください。` };
      }
    }

    let rowId = id;

    if (isDemoMode()) {
      const rows = demoList(def);
      const existing = rows.find((row) => row.id === rowId);
      if (existing) Object.assign(existing, payload);
      else {
        rowId = `${def.key}-${Math.random().toString(36).slice(2, 10)}`;
        rows.push({ id: rowId, [scopeColumn(def)]: scopeId, ...payload });
      }
    } else {
      const supabase = supabaseAdmin();
      if (rowId) {
        const { error } = await supabase
          .from(def.table)
          .update(payload)
          .eq('id', rowId)
          .eq(scopeColumn(def), scopeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from(def.table)
          .insert({ [scopeColumn(def)]: scopeId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        rowId = (data as { id: string }).id;
      }
    }

    revalidatePath('/', 'layout');
    return { ok: true, id: rowId };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMasterAction(
  masterKey: string,
  scopeId: string,
  id: string
): Promise<ActionResult> {
  try {
    const def = lookup(masterKey);
    await requireMasterEdit(def);

    if (isDemoMode()) {
      const state = db() as unknown as Record<string, Record<string, unknown>[]>;
      state[def.demoKey] = demoList(def).filter((row) => row.id !== id);
    } else {
      const { error } = await supabaseAdmin()
        .from(def.table)
        .delete()
        .eq('id', id)
        .eq(scopeColumn(def), scopeId);
      if (error) throw error;
    }

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
