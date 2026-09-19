'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import * as demo from '../demoMenu';
import { getCategoryRows, getMenuRows, getOptionRows } from '../menuQueries';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { Menu } from '../types';

/**
 * メニュー一括編集（仕様書 §5.8）。
 *
 * CSV の 1 行 = 1 メニュー。menuId が空の行は新規作成、埋まっている行は更新。
 * 消す操作は事故が大きいので CSV では扱わない（画面から個別に消す）。
 */

export const MENU_CSV_COLUMNS = [
  'menuId',
  'カテゴリ',
  'メニュー名',
  '伝票表示名',
  'スタッフ表示名',
  '説明文',
  '特集ラベル',
  'メニュータイプ',
  '画像サイズ',
  '税種別',
  '税率',
  '販売価格',
  '原価',
  '店外フラグ',
  'フリーキーフラグ',
  '案内用フラグ',
  '軽減税率対象',
  '表示順',
] as const;

export const OPTION_CSV_COLUMNS = [
  'optionId',
  'オプション名',
  '伝票表示名',
  '最小選択数',
  '最大選択数',
  '表示順',
  '選択肢名',
  '選択肢金額',
  '既定',
  '販売中',
] as const;

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: readonly string[], rows: unknown[][]): string {
  // Excel で開いたときに文字化けしないよう BOM を付ける
  return '\ufeff' + [header.join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\r\n');
}

const TYPE_LABEL: Record<string, string> = { food: 'フード', drink: 'ドリンク', other: 'その他' };
const SIZE_LABEL: Record<string, string> = {
  large: '大',
  medium: '中',
  small: '小',
  hidden: '非表示',
};

/** メニュー CSV のダウンロード */
export async function downloadMenuCsvAction(): Promise<{ ok: boolean; csv?: string; error?: string }> {
  try {
    const session = await requireSession();
    const companyId = session.currentCompanyId;

    const [menus, categories] = await Promise.all([
      getMenuRows(companyId),
      getCategoryRows(companyId),
    ]);

    const categoryOf = new Map<string, string[]>();
    for (const category of categories) {
      for (const menuId of category.menu_ids) {
        categoryOf.set(menuId, [...(categoryOf.get(menuId) ?? []), category.name]);
      }
    }

    const rows = menus.map((menu) => [
      menu.id,
      (categoryOf.get(menu.id) ?? []).join('|'),
      menu.name,
      menu.receipt_display_name ?? '',
      menu.staff_display_name ?? '',
      menu.description ?? '',
      menu.featured_label ?? '',
      TYPE_LABEL[menu.menu_type] ?? menu.menu_type,
      SIZE_LABEL[menu.image_size] ?? menu.image_size,
      menu.tax_method === 'incl' ? '税込' : '税抜',
      `${Math.round(menu.tax_rate * 100)}%`,
      menu.price,
      menu.cost_price ?? '',
      menu.is_takeout ? 1 : 0,
      menu.is_free_key ? 1 : 0,
      menu.is_notice_only ? 1 : 0,
      menu.reduced_rate_eligible ? 1 : 0,
      menu.display_order,
    ]);

    return { ok: true, csv: toCsv(MENU_CSV_COLUMNS, rows) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

/** オプション CSV のダウンロード。選択肢 1 つにつき 1 行 */
export async function downloadOptionCsvAction(): Promise<{
  ok: boolean;
  csv?: string;
  error?: string;
}> {
  try {
    const session = await requireSession();
    const options = await getOptionRows(session.currentCompanyId);

    const rows = options.flatMap((option) =>
      option.choices.map((choice) => [
        option.id,
        option.name,
        option.receipt_display_name ?? '',
        option.min_choice,
        option.max_choice,
        option.display_order,
        choice.name,
        choice.price,
        choice.is_default ? 1 : 0,
        choice.is_available ? 1 : 0,
      ])
    );

    return { ok: true, csv: toCsv(OPTION_CSV_COLUMNS, rows) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

/** アップロードされた CSV を読んで、いまの内容との差分を返す（確定前のプレビュー） */
export interface MenuCsvDiff {
  menuId: string;
  name: string;
  kind: 'create' | 'update' | 'unchanged';
  changes: { column: string; before: string; after: string }[];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const body = text.replace(/^\ufeff/, '');

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];

    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const TYPE_FROM_LABEL: Record<string, string> = {
  フード: 'food',
  ドリンク: 'drink',
  その他: 'other',
};
const SIZE_FROM_LABEL: Record<string, string> = {
  大: 'large',
  中: 'medium',
  小: 'small',
  非表示: 'hidden',
};

/** CSV の 1 行を、menus の列の形に直す */
function rowToMenu(header: string[], row: string[]) {
  const get = (column: string) => {
    const index = header.indexOf(column);
    return index === -1 ? '' : (row[index] ?? '').trim();
  };

  const taxRate = get('税率').replace('%', '');

  return {
    id: get('menuId'),
    values: {
      name: get('メニュー名'),
      receipt_display_name: get('伝票表示名') || get('メニュー名'),
      staff_display_name: get('スタッフ表示名') || null,
      description: get('説明文') || null,
      featured_label: get('特集ラベル') || null,
      menu_type: TYPE_FROM_LABEL[get('メニュータイプ')] ?? 'food',
      image_size: SIZE_FROM_LABEL[get('画像サイズ')] ?? 'medium',
      tax_method: get('税種別') === '税抜' ? 'excl' : 'incl',
      tax_rate: taxRate === '' ? 0.1 : Number(taxRate) / 100,
      price: Math.round(Number(get('販売価格')) || 0),
      cost_price: get('原価') === '' ? null : Math.round(Number(get('原価')) || 0),
      is_takeout: get('店外フラグ') === '1',
      is_free_key: get('フリーキーフラグ') === '1',
      is_notice_only: get('案内用フラグ') === '1',
      reduced_rate_eligible: get('軽減税率対象') !== '0',
      display_order: Math.round(Number(get('表示順')) || 0),
    },
  };
}

export async function previewMenuCsvAction(
  text: string
): Promise<{ ok: boolean; diffs?: MenuCsvDiff[]; error?: string }> {
  try {
    const session = await requireSession();
    const menus = await getMenuRows(session.currentCompanyId);
    const byId = new Map(menus.map((m) => [m.id, m]));

    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: false, error: '行がありません。' };

    const header = rows[0].map((h) => h.trim());
    if (!header.includes('メニュー名')) {
      return { ok: false, error: 'メニュー名の列が見つかりません。書式を確認してください。' };
    }

    const diffs: MenuCsvDiff[] = rows.slice(1).map((row) => {
      const parsed = rowToMenu(header, row);
      const current = parsed.id ? byId.get(parsed.id) : undefined;

      if (!current) {
        return { menuId: parsed.id, name: parsed.values.name, kind: 'create', changes: [] };
      }

      const changes: MenuCsvDiff['changes'] = [];
      for (const [key, after] of Object.entries(parsed.values)) {
        const before = (current as unknown as Record<string, unknown>)[key];
        if (String(before ?? '') !== String(after ?? '')) {
          changes.push({ column: key, before: String(before ?? ''), after: String(after ?? '') });
        }
      }

      return {
        menuId: parsed.id,
        name: parsed.values.name,
        kind: changes.length > 0 ? 'update' : 'unchanged',
        changes,
      };
    });

    return { ok: true, diffs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

/** プレビューで確認した内容を書き込む */
export async function applyMenuCsvAction(
  text: string
): Promise<{ ok: boolean; created?: number; updated?: number; error?: string }> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'menu_master')) {
      throw new Error('メニューを編集する権限がありません。');
    }

    const companyId = session.currentCompanyId;
    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: false, error: '行がありません。' };

    const header = rows[0].map((h) => h.trim());
    let created = 0;
    let updated = 0;

    for (const row of rows.slice(1)) {
      const parsed = rowToMenu(header, row);
      if (!parsed.values.name) continue;

      if (isDemoMode()) {
        const id = demo.saveMenu(companyId, {
          ...(parsed.values as unknown as Partial<Menu>),
          id: parsed.id || undefined,
        });
        if (parsed.id) updated += 1;
        else if (id) created += 1;
      } else {
        const supabase = supabaseAdmin();

        if (parsed.id) {
          const { error } = await supabase
            .from('menus')
            .update(parsed.values)
            .eq('id', parsed.id)
            .eq('company_id', companyId);
          if (error) throw error;
          updated += 1;
        } else {
          const { data, error } = await supabase
            .from('menus')
            .insert({ company_id: companyId, ...parsed.values })
            .select('id')
            .single();
          if (error) throw error;
          created += 1;

          // 新しいメニューは、その業態の全店舗で取扱 ON にしておく
          const { data: shops } = await supabase
            .from('shops')
            .select('id')
            .eq('company_id', companyId);
          const menuId = (data as { id: string }).id;
          const links = ((shops ?? []) as { id: string }[]).map((shop) => ({
            shop_id: shop.id,
            menu_id: menuId,
          }));
          if (links.length > 0) await supabase.from('shop_menus').insert(links);
        }
      }
    }

    revalidatePath('/menu');
    revalidatePath('/menuMasterCsv');
    return { ok: true, created, updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
