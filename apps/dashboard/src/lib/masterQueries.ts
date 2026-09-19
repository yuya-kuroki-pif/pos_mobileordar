import 'server-only';

import { clone, db, type DemoState } from './demo';
import { MASTERS, type MasterDef, type OptionSource } from './masters';
import { isDemoMode, supabaseAdmin } from './supabase';

export type MasterRow = Record<string, unknown> & { id: string };

export interface MasterBoard {
  rows: MasterRow[];
  /** select 用の選択肢 */
  options: Partial<Record<OptionSource, { value: string; label: string }[]>>;
}

function scopeColumn(def: MasterDef) {
  if (def.scope === 'corporation') return 'corporation_id';
  return def.scope === 'company' ? 'company_id' : 'shop_id';
}

function demoRows(def: MasterDef): MasterRow[] {
  const state = db() as unknown as Record<string, MasterRow[]>;
  return state[def.demoKey] ?? [];
}

/** 一覧と、その画面が必要とする選択肢をまとめて読む */
export async function getMasterBoard(
  masterKey: string,
  scopeId: string,
  /** shop スコープの画面でも、メニューは業態単位なので別に受け取る */
  companyId: string
): Promise<MasterBoard> {
  const def = MASTERS[masterKey];
  if (!def) throw new Error(`未定義のマスターです: ${masterKey}`);

  const rows = await readRows(def, scopeId);
  const options: MasterBoard['options'] = {};

  for (const need of def.needs ?? []) {
    options[need] = await readOptions(need, scopeId, companyId);
  }

  return { rows, options };
}

async function readRows(def: MasterDef, scopeId: string): Promise<MasterRow[]> {
  if (isDemoMode()) {
    const column = scopeColumn(def);
    return clone(demoRows(def).filter((row) => row[column] === scopeId)).sort(
      (a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0)
    );
  }

  const { data, error } = await supabaseAdmin()
    .from(def.table)
    .select('*')
    .eq(scopeColumn(def), scopeId)
    .order('display_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as MasterRow[];
}

async function readOptions(
  source: OptionSource,
  shopId: string,
  companyId: string
): Promise<{ value: string; label: string }[]> {
  if (isDemoMode()) {
    const state = db() as DemoState;
    if (source === 'kitchenPrinters') {
      return state.kitchenPrinters
        .filter((p) => p.shop_id === shopId)
        .map((p) => ({ value: p.id, label: p.name }));
    }
    return state.menus
      .filter((m) => m.company_id === companyId)
      .map((m) => ({ value: m.id, label: m.name }));
  }

  const supabase = supabaseAdmin();

  if (source === 'kitchenPrinters') {
    const { data, error } = await supabase
      .from('kitchen_printers')
      .select('id, name')
      .eq('shop_id', shopId)
      .order('display_order');
    if (error) throw new Error(error.message);
    return ((data ?? []) as { id: string; name: string }[]).map((r) => ({
      value: r.id,
      label: r.name,
    }));
  }

  const { data, error } = await supabase
    .from('menus')
    .select('id, name')
    .eq('company_id', companyId)
    .order('display_order');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; name: string }[]).map((r) => ({
    value: r.id,
    label: r.name,
  }));
}
