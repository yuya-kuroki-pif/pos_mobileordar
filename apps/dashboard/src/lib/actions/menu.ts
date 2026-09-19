'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import * as demo from '../demoMenu';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { ImageSize, Locale, MenuTranslation, MenuTypeValue, ShopMenu, TaxMethod } from '../types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

/** メニューマスターの書き込みは編集権限が要る（仕様書 §10.2 の二重チェック） */
async function requireMenuEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'menu_master')) {
    throw new Error('メニューを編集する権限がありません。');
  }
  return session;
}

export interface MenuFormInput {
  id: string;
  name: string;
  receipt_display_name: string;
  staff_display_name: string;
  description: string;
  featured_label: string;
  menu_type: MenuTypeValue;
  image_size: ImageSize;
  tax_method: TaxMethod;
  tax_rate: number;
  price: number;
  cost_price: number | null;
  is_takeout: boolean;
  is_free_key: boolean;
  is_notice_only: boolean;
  reduced_rate_eligible: boolean;
  display_order: number;
  categoryIds: string[];
}

/** 基本情報タブの保存。カテゴリの紐付けも同時に貼り直す */
export async function saveMenuAction(input: MenuFormInput): Promise<ActionResult> {
  try {
    const session = await requireMenuEdit();
    const companyId = session.currentCompanyId;

    const name = input.name.trim();
    if (!name) return { ok: false, error: 'メニュー名を入力してください。' };

    const payload = {
      name,
      receipt_display_name: input.receipt_display_name.trim() || name,
      staff_display_name: input.staff_display_name.trim() || null,
      description: input.description.trim() || null,
      featured_label: input.featured_label.trim() || null,
      menu_type: input.menu_type,
      image_size: input.image_size,
      tax_method: input.tax_method,
      tax_rate: input.tax_rate,
      price: Math.max(0, Math.round(input.price)),
      cost_price: input.cost_price === null ? null : Math.max(0, Math.round(input.cost_price)),
      is_takeout: input.is_takeout,
      is_free_key: input.is_free_key,
      is_notice_only: input.is_notice_only,
      reduced_rate_eligible: input.reduced_rate_eligible,
      display_order: input.display_order,
    };

    let menuId = input.id;

    if (isDemoMode()) {
      menuId = demo.saveMenu(companyId, { ...payload, id: input.id || undefined });
      demo.setMenuCategories(menuId, input.categoryIds);
    } else {
      const db = supabaseAdmin();

      if (menuId) {
        const { error } = await db
          .from('menus')
          .update(payload)
          .eq('id', menuId)
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { data, error } = await db
          .from('menus')
          .insert({ company_id: companyId, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        menuId = (data as { id: string }).id;

        // 新規作成したメニューは、その業態の全店舗で取扱 ON にしておく
        const { data: shops } = await db.from('shops').select('id').eq('company_id', companyId);
        const rows = ((shops ?? []) as { id: string }[]).map((shop) => ({
          shop_id: shop.id,
          menu_id: menuId,
        }));
        if (rows.length > 0) await db.from('shop_menus').insert(rows);
      }

      // カテゴリの紐付けは貼り直す
      await db.from('category_menus').delete().eq('menu_id', menuId);
      if (input.categoryIds.length > 0) {
        const { error } = await db.from('category_menus').insert(
          input.categoryIds.map((categoryId, index) => ({
            category_id: categoryId,
            menu_id: menuId,
            display_order: index * 10,
          }))
        );
        if (error) throw error;
      }
    }

    revalidatePath('/menu');
    revalidatePath(`/menu/${menuId}/edit`);
    return { ok: true, id: menuId };
  } catch (error) {
    return fail(error);
  }
}

/** オプションタブ。紐付けをまとめて貼り直す */
export async function setMenuOptionsAction(
  menuId: string,
  optionIds: string[]
): Promise<ActionResult> {
  try {
    await requireMenuEdit();

    if (isDemoMode()) {
      demo.setMenuOptions(menuId, optionIds);
    } else {
      const db = supabaseAdmin();
      await db.from('menu_options').delete().eq('menu_id', menuId);
      if (optionIds.length > 0) {
        const { error } = await db.from('menu_options').insert(
          optionIds.map((optionId, index) => ({
            menu_id: menuId,
            option_id: optionId,
            display_order: index * 10,
          }))
        );
        if (error) throw error;
      }
    }

    revalidatePath(`/menu/${menuId}/option`);
    revalidatePath('/menu');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * 取扱設定タブ。Switch を切り替えるたびに 1 行ぶんだけ即時保存する
 * （仕様書 §5.13 の「Switch はインライン即時保存」に合わせる）。
 */
export async function updateShopMenuAction(
  shopId: string,
  menuId: string,
  patch: Partial<ShopMenu>
): Promise<ActionResult> {
  try {
    await requireMenuEdit();

    if (isDemoMode()) {
      demo.updateShopMenu(shopId, menuId, patch);
    } else {
      const { error } = await supabaseAdmin()
        .from('shop_menus')
        .upsert({ shop_id: shopId, menu_id: menuId, ...patch }, { onConflict: 'shop_id,menu_id' });
      if (error) throw error;
    }

    revalidatePath(`/menu/${menuId}/dealer`);
    revalidatePath('/menu');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** 多言語設定タブ。空欄の言語は保存しない */
export async function saveMenuTranslationsAction(
  menuId: string,
  rows: { locale: Locale; name: string; description: string; featured_label: string }[]
): Promise<ActionResult> {
  try {
    await requireMenuEdit();

    const filled: MenuTranslation[] = rows
      .filter((row) => row.name.trim() || row.description.trim() || row.featured_label.trim())
      .map((row) => ({
        menu_id: menuId,
        locale: row.locale,
        name: row.name.trim() || null,
        description: row.description.trim() || null,
        featured_label: row.featured_label.trim() || null,
      }));

    if (isDemoMode()) {
      demo.saveMenuTranslations(menuId, filled);
    } else {
      const db = supabaseAdmin();
      await db.from('menu_translations').delete().eq('menu_id', menuId);
      if (filled.length > 0) {
        const { error } = await db.from('menu_translations').insert(filled);
        if (error) throw error;
      }
    }

    revalidatePath(`/menu/${menuId}/translation`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * 他店舗の取扱一括設定（仕様書 §5.13）。
 *
 * ある店舗の取扱設定を、同じ業態の別店舗へまるごと写す。
 * 出力先（キッチンプリンター・デシャップグループ）は店舗ごとの実体なので写さない。
 */
export async function copyShopMenusAction(
  sourceShopId: string,
  targetShopIds: string[]
): Promise<ActionResult> {
  try {
    const session = await requireMenuEdit();

    const source = session.shops.find((shop) => shop.id === sourceShopId);
    if (!source) return { ok: false, error: 'コピー元の店舗が見つかりません。' };

    const targets = targetShopIds.filter((id) =>
      session.shops.some((shop) => shop.id === id && shop.company_id === source.company_id)
    );
    if (targets.length === 0) {
      return { ok: false, error: '同じ業態のコピー先店舗を選んでください。' };
    }

    if (isDemoMode()) {
      demo.copyShopMenus(sourceShopId, targets);
    } else {
      const db = supabaseAdmin();

      const { data, error } = await db.from('shop_menus').select('*').eq('shop_id', sourceShopId);
      if (error) throw error;

      const rows = (data ?? []) as Record<string, unknown>[];
      for (const shopId of targets) {
        const { error: upsertError } = await db.from('shop_menus').upsert(
          rows.map((row) => ({
            ...row,
            shop_id: shopId,
            // 出力先は店舗ごとの実体を指すので引き継がない
            kitchen_printer_id: null,
            dish_up_slip_group_id: null,
          })),
          { onConflict: 'shop_id,menu_id' }
        );
        if (upsertError) throw upsertError;
      }
    }

    revalidatePath('/shop/menu');
    revalidatePath('/menu');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
