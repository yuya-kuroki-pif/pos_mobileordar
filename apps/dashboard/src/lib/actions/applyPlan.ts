'use server';

import { requireSession } from '../auth';
import type { PlannedOp } from '../agent/types';
import { describeOp } from '../agent/types';
import { getCategoryRows, getMenuDetail, getOptionRows } from '../menuQueries';
import { canEdit } from '../permissions';
import { saveCategoryAction } from './category';
import { saveMenuAction, setMenuOptionsAction, updateShopMenuAction } from './menu';
import { saveOptionAction } from './option';

/**
 * アシスタントが立てた計画を、人が確認してから実際に書き込む。
 * 既存のマスター保存アクションをそのまま呼ぶので、
 * 画面から手で登録したときと同じ検証・同じ副作用になる。
 */

export interface ApplyLine {
  description: string;
  ok: boolean;
  error?: string;
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  lines?: ApplyLine[];
}

export async function applyPlanAction(plan: PlannedOp[]): Promise<ApplyResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'menu_master')) {
      return { ok: false, error: 'メニューマスターを編集する権限がありません。' };
    }
    if (plan.length === 0) return { ok: false, error: '実行する内容がありません。' };

    const companyId = session.currentCompanyId;

    // カテゴリ名 → ID。計画の中で新しく作ったカテゴリも、後続のメニューから使えるようにする
    const categoryIds = new Map<string, string>();
    for (const row of await getCategoryRows(companyId)) {
      categoryIds.set(row.name, row.id);
    }

    const lines: ApplyLine[] = [];

    for (const op of plan) {
      const description = describeOp(op);
      try {
        switch (op.kind) {
          case 'create_category': {
            const result = await saveCategoryAction({
              id: '',
              name: op.name,
              staff_display_name: '',
              description: '',
              handy_bg_color: null,
              kds_color: null,
              display_order: (categoryIds.size + 1) * 10,
              is_active: true,
              menuIds: [],
            });
            if (!result.ok) throw new Error(result.error);
            if (result.id) categoryIds.set(op.name, result.id);
            break;
          }

          case 'create_menu': {
            const unknown = op.categories.filter((name) => !categoryIds.has(name));
            if (unknown.length > 0) {
              throw new Error(`カテゴリが見つかりません: ${unknown.join('、')}`);
            }
            const result = await saveMenuAction({
              id: '',
              name: op.name,
              receipt_display_name: '',
              staff_display_name: '',
              description: op.description ?? '',
              featured_label: '',
              menu_type: op.menu_type,
              image_size: 'medium',
              tax_method: 'incl',
              tax_rate: op.tax_rate,
              price: op.price,
              cost_price: null,
              is_takeout: false,
              is_free_key: false,
              is_notice_only: false,
              reduced_rate_eligible: op.tax_rate === 8,
              display_order: 0,
              image_url: null,
              categoryIds: op.categories.map((name) => categoryIds.get(name) as string),
            });
            if (!result.ok) throw new Error(result.error);
            break;
          }

          case 'update_menu': {
            // 既存の値を読んでから差分だけ載せる。書き忘れで他の項目が消えないように
            const detail = await getMenuDetail(op.menu_id);
            if (!detail) throw new Error('メニューが見つかりません。');
            const menu = detail.menu;
            if (menu.company_id !== companyId) {
              throw new Error('別の業態のメニューは変更できません。');
            }
            const result = await saveMenuAction({
              id: menu.id,
              name: op.changes.name ?? menu.name,
              receipt_display_name: menu.receipt_display_name ?? '',
              staff_display_name: menu.staff_display_name ?? '',
              description:
                op.changes.description !== undefined
                  ? (op.changes.description ?? '')
                  : (menu.description ?? ''),
              featured_label: menu.featured_label ?? '',
              menu_type: menu.menu_type,
              image_size: menu.image_size,
              tax_method: menu.tax_method,
              tax_rate: menu.tax_rate,
              price: op.changes.price ?? menu.price,
              cost_price: menu.cost_price,
              is_takeout: menu.is_takeout,
              is_free_key: menu.is_free_key,
              is_notice_only: menu.is_notice_only,
              reduced_rate_eligible: menu.reduced_rate_eligible,
              display_order: menu.display_order,
              image_url: menu.image_url,
              categoryIds: detail.categoryIds,
            });
            if (!result.ok) throw new Error(result.error);
            break;
          }

          case 'create_option': {
            const result = await saveOptionAction({
              id: '',
              name: op.name,
              receipt_display_name: '',
              min_choice: op.is_required ? Math.max(1, op.min_choices) : op.min_choices,
              max_choice: op.max_choices,
              display_order: 0,
              choices: op.choices.map((choice, index) => ({
                id: `tmp-${index}`,
                option_id: '',
                name: choice.name,
                receipt_display_name: null,
                price: choice.price,
                is_default: index === 0,
                is_available: true,
                display_order: (index + 1) * 10,
              })),
              menuIds: [],
            });
            if (!result.ok) throw new Error(result.error);
            break;
          }

          case 'attach_option': {
            // すでに付いているメニューを消さないよう、今の紐付けに足す
            const options = await getOptionRows(companyId);
            const option = options.find((row) => row.id === op.option_id);
            if (!option) throw new Error('オプションが見つかりません。');

            const merged = [...new Set([...option.menu_ids, ...op.menu_ids])];
            for (const menuId of merged) {
              const detail = await getMenuDetail(menuId);
              if (!detail) continue;
              const optionIds = [...new Set([...detail.optionIds, op.option_id])];
              const result = await setMenuOptionsAction(menuId, optionIds);
              if (!result.ok) throw new Error(result.error);
            }
            break;
          }

          case 'set_menu_visibility': {
            const shop = session.shops.find((s) => s.id === op.shop_id);
            if (!shop || shop.company_id !== companyId) {
              throw new Error('店舗が見つかりません。');
            }
            const result = await updateShopMenuAction(op.shop_id, op.menu_id, {
              is_dealing: op.is_dealing,
            });
            if (!result.ok) throw new Error(result.error);
            break;
          }

          case 'set_sold_out': {
            const shop = session.shops.find((s) => s.id === op.shop_id);
            if (!shop || shop.company_id !== companyId) {
              throw new Error('店舗が見つかりません。');
            }
            const result = await updateShopMenuAction(op.shop_id, op.menu_id, {
              in_stock: !op.sold_out,
            });
            if (!result.ok) throw new Error(result.error);
            break;
          }
        }
        lines.push({ description, ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lines.push({ description, ok: false, error: message || '失敗しました' });
      }
    }

    return { ok: lines.some((line) => line.ok), lines };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '実行に失敗しました' };
  }
}
