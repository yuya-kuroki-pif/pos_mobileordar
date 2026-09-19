import type { FeatureKey } from './permissions';

/**
 * 単純なマスター画面（一覧 + 追加 + 編集 + 削除）の定義。
 *
 * 仕様書には同じ形の一覧が何画面も出てくるので、列と入力欄を宣言して
 * 1 つの画面コンポーネントで賄う。凝った画面（おすすめメニュー・テーブルなど）は
 * それぞれ専用に作る。
 */

export type MasterScope = 'corporation' | 'company' | 'shop';

/** select の選択肢をどこから作るか */
export type OptionSource = 'kitchenPrinters' | 'menus';

export type MasterFieldType = 'text' | 'number' | 'money' | 'switch' | 'select' | 'enum';

export interface MasterField {
  key: string;
  label: string;
  type: MasterFieldType;
  required?: boolean;
  width?: number;
  extra?: string;
  placeholder?: string;
  /** type='select' のとき */
  optionsFrom?: OptionSource;
  /** type='enum' のとき */
  choices?: { value: string; label: string }[];
  /** 一覧には出さず、編集フォームだけに出す */
  formOnly?: boolean;
  defaultValue?: string | number | boolean | null;
}

export interface MasterDef {
  key: string;
  table: string;
  /** デモ用インメモリ状態のキー */
  demoKey: string;
  scope: MasterScope;
  title: string;
  description: string;
  breadcrumb: string[];
  feature: FeatureKey;
  fields: MasterField[];
  /** 画面で使う選択肢を読むかどうか */
  needs?: OptionSource[];
}

const ORDER_FIELD: MasterField = {
  key: 'display_order',
  label: '表示順',
  type: 'number',
  width: 100,
  extra: '小さいほど先頭',
  defaultValue: 0,
};

export const MASTERS: Record<string, MasterDef> = {
  clerk: {
    key: 'clerk',
    table: 'clerks',
    demoKey: 'clerks',
    scope: 'shop',
    title: '店員',
    description: '会計担当者の選択とスタッフ評価に使います',
    breadcrumb: ['店舗管理', '店員'],
    feature: 'shop_management',
    fields: [
      { key: 'name', label: '店員名', type: 'text', required: true, placeholder: '例: 山田' },
      { key: 'is_visible', label: '表示', type: 'switch', width: 100, defaultValue: true },
      ORDER_FIELD,
    ],
  },

  cookingItem: {
    key: 'cookingItem',
    table: 'cooking_items',
    demoKey: 'cookingItems',
    scope: 'shop',
    title: '調理アイテム',
    description: '調理の区分ごとに、伝票を出すキッチンプリンターを決めます',
    breadcrumb: ['店舗管理', '印刷オプション設定', '調理アイテム'],
    feature: 'shop_management',
    fields: [
      { key: 'name', label: '調理アイテム名', type: 'text', required: true, placeholder: '例: 焼き物' },
      {
        key: 'kitchen_printer_id',
        label: 'キッチンプリンター',
        type: 'select',
        optionsFrom: 'kitchenPrinters',
        width: 200,
        defaultValue: null,
      },
      ORDER_FIELD,
    ],
    needs: ['kitchenPrinters'],
  },

  dishUpSlipGroup: {
    key: 'dishUpSlipGroup',
    table: 'dish_up_slip_groups',
    demoKey: 'dishUpSlipGroups',
    scope: 'shop',
    title: 'デシャップグループ',
    description: '提供場所のまとまり。メニューの出力先として使います',
    breadcrumb: ['店舗管理', '印刷オプション設定', 'デシャップグループ'],
    feature: 'shop_management',
    fields: [
      { key: 'name', label: 'デシャップグループ名', type: 'text', required: true, placeholder: '例: 焼き場' },
      ORDER_FIELD,
    ],
  },

  kitchenPrinter: {
    key: 'kitchenPrinter',
    table: 'kitchen_printers',
    demoKey: 'kitchenPrinters',
    scope: 'shop',
    title: 'キッチンプリンター',
    description: '印刷先の論理ロール。メニューをここに紐付け、端末側で物理プリンターへ割り当てます',
    breadcrumb: ['店舗管理', 'キッチンプリンター一覧'],
    feature: 'shop_management',
    fields: [
      { key: 'name', label: 'キッチンプリンター名', type: 'text', required: true, placeholder: '例: キッチン' },
      { key: 'notify_mobile_payment', label: 'モバイル決済通知', type: 'switch', width: 150 },
      { key: 'print_call_slip', label: '呼出伝票印刷', type: 'switch', width: 130 },
      { key: 'print_checkout_slip', label: '自動会計伝票印刷', type: 'switch', width: 150 },
      { key: 'print_dish_up_slip', label: 'デシャップ伝票印刷', type: 'switch', width: 160 },
      { key: 'print_table_move_slip', label: 'テーブル移動伝票印刷', type: 'switch', width: 180 },
      { key: 'dish_up_layout', label: 'デシャップレイアウト', type: 'text', width: 180, defaultValue: null },
      {
        key: 'print_sound',
        label: '印刷音',
        type: 'enum',
        width: 110,
        choices: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'none', label: 'なし' },
        ],
        defaultValue: 'none',
      },
      {
        key: 'fallback_printer_1_id',
        label: '緊急時の振替先 1',
        type: 'select',
        optionsFrom: 'kitchenPrinters',
        width: 180,
        formOnly: true,
        defaultValue: null,
      },
      {
        key: 'fallback_printer_2_id',
        label: '緊急時の振替先 2',
        type: 'select',
        optionsFrom: 'kitchenPrinters',
        width: 180,
        formOnly: true,
        defaultValue: null,
      },
      ORDER_FIELD,
    ],
    needs: ['kitchenPrinters'],
  },

  plAccount: {
    key: 'plAccount',
    table: 'pl_accounts',
    demoKey: 'plAccounts',
    scope: 'corporation',
    title: '科目',
    description: '損益計算書の科目。仕入れや小口現金の登録先になります',
    breadcrumb: ['経営管理', '科目登録'],
    feature: 'pl_accounts',
    fields: [
      { key: 'code', label: 'コード', type: 'text', width: 100, placeholder: '例: 5100' },
      {
        key: 'pl_section',
        label: 'PL区分',
        type: 'enum',
        required: true,
        width: 140,
        choices: [
          { value: 'sales', label: '売上' },
          { value: 'cogs', label: '売上原価' },
          { value: 'labor', label: '人件費' },
          { value: 'sga', label: '販売管理費' },
        ],
        defaultValue: 'cogs',
      },
      { key: 'name', label: '科目名', type: 'text', required: true, width: 180, placeholder: '例: 仕入高' },
      { key: 'sub_name', label: '補助科目名', type: 'text', width: 160, defaultValue: null },
      {
        key: 'cost_class',
        label: '費用分類',
        type: 'enum',
        width: 120,
        choices: [
          { value: 'variable', label: '変動費' },
          { value: 'fixed', label: '固定費' },
        ],
        defaultValue: null,
      },
      { key: 'petty_cash_usable', label: '小口現金で使う', type: 'switch', width: 150 },
      { key: 'is_visible', label: '表示', type: 'switch', width: 100, defaultValue: true },
      { key: 'note', label: '備考', type: 'text', formOnly: true, defaultValue: null },
      ORDER_FIELD,
    ],
  },

  vendor: {
    key: 'vendor',
    table: 'vendors',
    demoKey: 'vendors',
    scope: 'corporation',
    title: '取引先',
    description: '仕入れや支払いの相手先',
    breadcrumb: ['経営管理', '取引先登録'],
    feature: 'vendor_registration',
    fields: [
      { key: 'name', label: '取引先名', type: 'text', required: true, placeholder: '例: 山田酒店' },
      { key: 'kind', label: '種別', type: 'text', width: 160, defaultValue: null, placeholder: '例: 酒類' },
      { key: 'note', label: '備考', type: 'text', defaultValue: null },
      ORDER_FIELD,
    ],
  },
};
