import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';

import { getCategoryRows, getMenuRows, getOptionRows } from '../menuQueries';
import type { Shop } from '../types';

import type { PlannedOp } from './types';

/**
 * AI に渡す道具。
 *
 * 読み取りはその場で実行し、書き込みは「計画に積む」だけにする。
 * こうしておけば、AI が勘違いしても人が止められる。
 */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_categories',
    description: 'いまの業態に登録されているカテゴリの一覧を返す。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_menus',
    description:
      'いまの業態に登録されているメニューの一覧を返す。名前・価格・カテゴリが分かる。' +
      '既存メニューを直すときは、必ず先にこれで menu_id を確かめること。',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'メニュー名の一部で絞り込む（任意）' },
      },
    },
  },
  {
    name: 'list_options',
    description: 'いまの業態のオプション（焼き加減・サイズなど）の一覧を返す。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_shops',
    description: 'いまの業態の店舗一覧を返す。売切の切り替えなど、店舗を指定するときに使う。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'plan_create_category',
    description: 'カテゴリを新しく作る計画を積む。同じ名前のカテゴリが既にある場合は積まないこと。',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'カテゴリ名' } },
      required: ['name'],
    },
  },
  {
    name: 'plan_create_menu',
    description:
      'メニューを新しく作る計画を積む。価格は税込の整数（円）。' +
      'カテゴリは既存の名前を使う。無ければ先に plan_create_category を呼ぶこと。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'メニュー名' },
        price: { type: 'number', description: '販売価格（税込・円）' },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: '入れるカテゴリ名。複数可',
        },
        menu_type: {
          type: 'string',
          enum: ['food', 'drink', 'other'],
          description: 'フード / ドリンク / その他',
        },
        description: { type: 'string', description: 'メニューの説明文（任意）' },
        tax_rate: {
          type: 'number',
          description: '税率。店内飲食は 0.1、持ち帰り前提の飲食料品は 0.08。既定は 0.1',
        },
      },
      required: ['name', 'price', 'menu_type'],
    },
  },
  {
    name: 'plan_update_menu',
    description: '既存メニューを変える計画を積む。menu_id は list_menus で調べた値を使うこと。',
    input_schema: {
      type: 'object',
      properties: {
        menu_id: { type: 'string', description: 'list_menus で得た ID' },
        name: { type: 'string', description: '新しいメニュー名（変える場合のみ）' },
        price: { type: 'number', description: '新しい価格（変える場合のみ）' },
        description: { type: 'string', description: '新しい説明文（変える場合のみ）' },
      },
      required: ['menu_id'],
    },
  },
  {
    name: 'plan_set_sold_out',
    description: '店舗ごとの売切を切り替える計画を積む。',
    input_schema: {
      type: 'object',
      properties: {
        menu_id: { type: 'string', description: 'list_menus で得た ID' },
        shop_id: { type: 'string', description: 'list_shops で得た ID' },
        sold_out: { type: 'boolean', description: 'true で売切、false で解除' },
      },
      required: ['menu_id', 'shop_id', 'sold_out'],
    },
  },
  {
    name: 'plan_create_option',
    description:
      'オプション（焼き加減・サイズ・トッピングなど）を新しく作る計画を積む。' +
      '選択肢の追加料金は税込の整数（円）。無料なら 0。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'オプション名。例: 焼き加減' },
        is_required: { type: 'boolean', description: '必ず選ばせるか' },
        min_choices: { type: 'number', description: '最低いくつ選ばせるか' },
        max_choices: { type: 'number', description: '最大いくつ選べるか' },
        choices: {
          type: 'array',
          description: '選択肢',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'number', description: '追加料金（円、税込）' },
            },
            required: ['name', 'price'],
          },
        },
      },
      required: ['name', 'choices'],
    },
  },
  {
    name: 'plan_attach_option',
    description:
      '既にあるオプションを、既にあるメニューに付ける計画を積む。' +
      'option_id は list_options、menu_ids は list_menus で確かめること。',
    input_schema: {
      type: 'object',
      properties: {
        option_id: { type: 'string' },
        menu_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['option_id', 'menu_ids'],
    },
  },
  {
    name: 'plan_set_menu_visibility',
    description:
      '店舗でそのメニューを扱うかどうかを切り替える計画を積む。' +
      '「この店では出さない」は売切ではなくこちら。',
    input_schema: {
      type: 'object',
      properties: {
        menu_id: { type: 'string' },
        shop_id: { type: 'string' },
        is_dealing: { type: 'boolean', description: 'true で扱う、false で扱わない' },
      },
      required: ['menu_id', 'shop_id', 'is_dealing'],
    },
  },
];

export interface ToolContext {
  companyId: string;
  shops: Shop[];
  /** 書き込み系はここに積む */
  plan: PlannedOp[];
}

/** 1 つの道具を動かして、AI に返す文字列を作る */
export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  switch (name) {
    case 'list_categories': {
      const rows = await getCategoryRows(ctx.companyId);
      if (rows.length === 0) return 'カテゴリはまだ 1 つもありません。';
      return rows.map((r) => `${r.name}（${r.menu_ids.length} 品）`).join('\n');
    }

    case 'list_menus': {
      const keyword = String(input.keyword ?? '').trim();
      const rows = await getMenuRows(ctx.companyId);
      const filtered = keyword ? rows.filter((r) => r.name.includes(keyword)) : rows;

      if (filtered.length === 0) return '該当するメニューはありません。';
      return filtered
        .map(
          (r) =>
            `${r.id} | ${r.name} | ¥${r.price} | ${
              r.category_names.length > 0 ? r.category_names.join('・') : 'カテゴリ未設定'
            }`
        )
        .join('\n');
    }

    case 'list_options': {
      const rows = await getOptionRows(ctx.companyId);
      if (rows.length === 0) return 'オプションはまだありません。';
      return rows.map((r) => `${r.name}（${r.choices.map((c) => c.name).join('・')}）`).join('\n');
    }

    case 'list_shops': {
      if (ctx.shops.length === 0) return 'この業態には店舗がありません。';
      return ctx.shops.map((s) => `${s.id} | ${s.name}`).join('\n');
    }

    case 'plan_create_category': {
      const name = String(input.name ?? '').trim();
      if (!name) return 'カテゴリ名が空です。';

      const existing = await getCategoryRows(ctx.companyId);
      if (existing.some((c) => c.name === name)) {
        return `「${name}」は既にあります。作る必要はありません。`;
      }
      if (ctx.plan.some((op) => op.kind === 'create_category' && op.name === name)) {
        return `「${name}」は既にこの計画に入っています。`;
      }

      ctx.plan.push({ kind: 'create_category', name });
      return `計画に追加しました: カテゴリ「${name}」`;
    }

    case 'plan_create_menu': {
      const name = String(input.name ?? '').trim();
      const price = Math.round(Number(input.price));
      if (!name) return 'メニュー名が空です。';
      if (!Number.isFinite(price) || price < 0) return '価格が正しくありません。';

      const existing = await getMenuRows(ctx.companyId);
      if (existing.some((m) => m.name === name)) {
        return `「${name}」は既に登録されています。価格を変えたい場合は plan_update_menu を使ってください。`;
      }

      const menuType =
        input.menu_type === 'drink' ? 'drink' : input.menu_type === 'other' ? 'other' : 'food';
      const taxRate = Number(input.tax_rate);

      ctx.plan.push({
        kind: 'create_menu',
        name,
        price,
        categories: Array.isArray(input.categories) ? (input.categories as string[]) : [],
        menu_type: menuType,
        description: input.description ? String(input.description) : null,
        tax_rate: taxRate === 0.08 ? 0.08 : 0.1,
      });
      return `計画に追加しました: ${name} ¥${price}`;
    }

    case 'plan_update_menu': {
      const menuId = String(input.menu_id ?? '');
      const rows = await getMenuRows(ctx.companyId);
      const menu = rows.find((m) => m.id === menuId);
      if (!menu) return `ID ${menuId} のメニューが見つかりません。list_menus で確かめてください。`;

      const changes: { price?: number; name?: string; description?: string | null } = {};
      if (input.price !== undefined) changes.price = Math.round(Number(input.price));
      if (input.name !== undefined) changes.name = String(input.name);
      if (input.description !== undefined) changes.description = String(input.description);

      if (Object.keys(changes).length === 0) return '変える内容が指定されていません。';

      ctx.plan.push({ kind: 'update_menu', menu_id: menuId, menu_name: menu.name, changes });
      return `計画に追加しました: ${menu.name} の変更`;
    }

    case 'plan_set_sold_out': {
      const menuId = String(input.menu_id ?? '');
      const shopId = String(input.shop_id ?? '');
      const rows = await getMenuRows(ctx.companyId);
      const menu = rows.find((m) => m.id === menuId);
      const shop = ctx.shops.find((s) => s.id === shopId);

      if (!menu) return `ID ${menuId} のメニューが見つかりません。`;
      if (!shop) return `ID ${shopId} の店舗が見つかりません。`;

      ctx.plan.push({
        kind: 'set_sold_out',
        menu_id: menuId,
        menu_name: menu.name,
        shop_id: shopId,
        shop_name: shop.name,
        sold_out: Boolean(input.sold_out),
      });
      return `計画に追加しました: ${menu.name}（${shop.name}）の売切設定`;
    }

    case 'plan_create_option': {
      const optionName = String(input.name ?? '').trim();
      if (!optionName) return 'オプション名がありません。';

      const raw = Array.isArray(input.choices) ? input.choices : [];
      const choices = raw
        .map((row) => {
          const item = row as { name?: unknown; price?: unknown };
          return {
            name: String(item.name ?? '').trim(),
            price: Math.max(0, Math.round(Number(item.price) || 0)),
          };
        })
        .filter((choice) => choice.name);

      if (choices.length === 0) return '選択肢が 1 つもありません。';

      const existing = await getOptionRows(ctx.companyId);
      if (existing.some((row) => row.name === optionName)) {
        return `「${optionName}」はすでにあります。新しく作る必要はありません。`;
      }
      if (ctx.plan.some((op) => op.kind === 'create_option' && op.name === optionName)) {
        return `「${optionName}」はすでに計画に入っています。`;
      }

      const max = Math.max(1, Math.round(Number(input.max_choices) || 1));

      ctx.plan.push({
        kind: 'create_option',
        name: optionName,
        is_required: Boolean(input.is_required),
        min_choices: Math.max(0, Math.round(Number(input.min_choices) || 0)),
        max_choices: max,
        choices,
      });
      return `計画に追加しました: オプション「${optionName}」（${choices.length} 択）`;
    }

    case 'plan_attach_option': {
      const optionId = String(input.option_id ?? '');
      const menuIds = Array.isArray(input.menu_ids) ? input.menu_ids.map(String) : [];

      const options = await getOptionRows(ctx.companyId);
      const option = options.find((row) => row.id === optionId);
      if (!option) return `ID ${optionId} のオプションが見つかりません。`;

      const menus = await getMenuRows(ctx.companyId);
      const matched = menus.filter((menu) => menuIds.includes(menu.id));
      if (matched.length === 0) return '指定されたメニューが見つかりません。';

      ctx.plan.push({
        kind: 'attach_option',
        option_id: optionId,
        option_name: option.name,
        menu_ids: matched.map((menu) => menu.id),
        menu_names: matched.map((menu) => menu.name),
      });
      return `計画に追加しました: 「${option.name}」を ${matched.length} 品に付ける`;
    }

    case 'plan_set_menu_visibility': {
      const menuId = String(input.menu_id ?? '');
      const shopId = String(input.shop_id ?? '');
      const menus = await getMenuRows(ctx.companyId);
      const menu = menus.find((row) => row.id === menuId);
      const shop = ctx.shops.find((row) => row.id === shopId);

      if (!menu) return `ID ${menuId} のメニューが見つかりません。`;
      if (!shop) return `ID ${shopId} の店舗が見つかりません。`;

      ctx.plan.push({
        kind: 'set_menu_visibility',
        menu_id: menuId,
        menu_name: menu.name,
        shop_id: shopId,
        shop_name: shop.name,
        is_dealing: Boolean(input.is_dealing),
      });
      return `計画に追加しました: ${menu.name}（${shop.name}）の取扱設定`;
    }

    default:
      return `知らない道具です: ${name}`;
  }
}
