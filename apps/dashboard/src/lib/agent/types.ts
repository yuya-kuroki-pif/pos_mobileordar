/**
 * 店舗スタッフが言葉でマスターを直せるようにする AI アシスタント。
 *
 * 安全side に倒すため、書き込みはその場では行わない。
 * AI は「こう変えます」という計画を返すだけで、実際に書くのは
 * 人が内容を見て「実行」を押したとき。CSV 一括編集と同じ考え方。
 */

export type PlannedOp =
  | {
      kind: 'create_menu';
      name: string;
      price: number;
      categories: string[];
      menu_type: 'food' | 'drink' | 'other';
      description: string | null;
      tax_rate: number;
    }
  | {
      kind: 'update_menu';
      menu_id: string;
      menu_name: string;
      changes: { price?: number; name?: string; description?: string | null };
    }
  | {
      kind: 'create_category';
      name: string;
    }
  | {
      kind: 'create_option';
      name: string;
      is_required: boolean;
      min_choices: number;
      max_choices: number;
      choices: { name: string; price: number }[];
    }
  | {
      kind: 'attach_option';
      option_id: string;
      option_name: string;
      menu_ids: string[];
      menu_names: string[];
    }
  | {
      kind: 'set_menu_visibility';
      menu_id: string;
      menu_name: string;
      shop_id: string;
      shop_name: string;
      /** 取扱そのものを止めるか */
      is_dealing: boolean;
    }
  | {
      kind: 'set_sold_out';
      menu_id: string;
      menu_name: string;
      shop_id: string;
      shop_name: string;
      sold_out: boolean;
    };

/** 画面に出す 1 往復ぶん */
export interface AgentMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AgentResult {
  ok: boolean;
  error?: string;
  /** AI の返答（人が読む文章） */
  reply?: string;
  /** 実行前に見せる変更の計画 */
  plan?: PlannedOp[];
  /** 会話の続きに渡す履歴 */
  history?: AgentMessage[];
}

/** 計画を人が読める 1 行にする */
export function describeOp(op: PlannedOp): string {
  switch (op.kind) {
    case 'create_menu':
      return `メニューを追加: ${op.name} / ¥${op.price.toLocaleString()} / ${
        op.categories.length > 0 ? op.categories.join('・') : 'カテゴリ未設定'
      }`;
    case 'update_menu': {
      const parts: string[] = [];
      if (op.changes.name) parts.push(`名前 → ${op.changes.name}`);
      if (op.changes.price !== undefined) parts.push(`価格 → ¥${op.changes.price.toLocaleString()}`);
      if (op.changes.description !== undefined) parts.push('説明文を変更');
      return `メニューを変更: ${op.menu_name}（${parts.join(' / ')}）`;
    }
    case 'create_category':
      return `カテゴリを追加: ${op.name}`;
    case 'create_option':
      return `オプションを追加: ${op.name}（${op.choices
        .map((c) => (c.price > 0 ? `${c.name} +¥${c.price}` : c.name))
        .join(' / ')}）`;
    case 'attach_option':
      return `オプション「${op.option_name}」を付ける: ${op.menu_names.join('、')}`;
    case 'set_menu_visibility':
      return `${op.is_dealing ? '取扱を開始' : '取扱を停止'}: ${op.menu_name}（${op.shop_name}）`;
    case 'set_sold_out':
      return `${op.sold_out ? '売切にする' : '売切を解除'}: ${op.menu_name}（${op.shop_name}）`;
  }
}
