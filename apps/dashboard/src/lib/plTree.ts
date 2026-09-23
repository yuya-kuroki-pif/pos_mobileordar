import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import { PL_SECTION_LABELS, type PlAccount, type PlSection } from './types';

/**
 * 損益計算書のツリー（仕様書 §6.2）。
 *
 * 行は PL区分 > 科目 > 補助科目 の 3 段。列は呼び出し側が決める
 * （店舗ごと / 月ごと / 日ごと）ので、ここでは「列キー → 金額」だけを持たせる。
 */

export interface PlNode {
  key: string;
  label: string;
  /** 列キー → 金額 */
  values: Record<string, number>;
  children?: PlNode[];
  /** 区分行・合計行を太字にするため */
  emphasis?: boolean;
}

const SECTION_ORDER: PlSection[] = ['sales', 'cogs', 'labor', 'sga'];

/** 1 行ぶんの実績。どの列に、どの科目で、いくら積むか */
export interface PlFact {
  column: string;
  accountId: string | null;
  section: PlSection;
  amount: number;
}

interface PlTransaction {
  shop_id: string;
  occurred_on: string;
  pl_account_id: string | null;
  amount: number;
}

/** 収支登録・小口現金の実績を読む。どちらも「科目つきの出費」として同じ形で扱う */
export async function getPlTransactions(
  shopIds: string[],
  from: string,
  to: string
): Promise<PlTransaction[]> {
  if (shopIds.length === 0) return [];

  const inRange = (row: PlTransaction) =>
    shopIds.includes(row.shop_id) && row.occurred_on >= from && row.occurred_on <= to;

  if (isDemoMode()) {
    const state = db();
    const rows = [
      ...(state.incomeExpenseTransactions as unknown as PlTransaction[]),
      ...(state.pettyCashTransactions as unknown as PlTransaction[]),
    ];
    return clone(rows.filter(inRange));
  }

  const supabase = supabaseAdmin();
  const [income, petty] = await Promise.all([
    supabase
      .from('income_expense_transactions')
      .select('shop_id, occurred_on, pl_account_id, amount')
      .in('shop_id', shopIds)
      .gte('occurred_on', from)
      .lte('occurred_on', to),
    supabase
      .from('petty_cash_transactions')
      .select('shop_id, occurred_on, pl_account_id, amount')
      .in('shop_id', shopIds)
      .gte('occurred_on', from)
      .lte('occurred_on', to),
  ]);

  for (const res of [income, petty]) {
    if (res.error) throw new Error(res.error.message);
  }

  return [
    ...((income.data ?? []) as PlTransaction[]),
    ...((petty.data ?? []) as PlTransaction[]),
  ];
}

function zero(columns: string[]): Record<string, number> {
  return Object.fromEntries(columns.map((column) => [column, 0]));
}

function add(into: Record<string, number>, from: Record<string, number>): void {
  for (const key of Object.keys(into)) into[key] += from[key] ?? 0;
}

/**
 * 実績を PL のツリーに組み立てる。
 * 科目が付いていない実績（売上や仕入れ）は `accountId: null` で渡し、
 * その区分の「その他」にまとめる。
 */
export function buildPlTree(
  accounts: PlAccount[],
  facts: PlFact[],
  columns: string[]
): { nodes: PlNode[]; profit: Record<string, number> } {
  const visible = accounts.filter((account) => account.is_visible);
  const byId = new Map(visible.map((account) => [account.id, account]));

  // 科目名でまとめ、その下に補助科目を置く
  const nodes: PlNode[] = [];
  const sectionTotals: Record<PlSection, Record<string, number>> = {
    sales: zero(columns),
    cogs: zero(columns),
    labor: zero(columns),
    sga: zero(columns),
  };

  for (const section of SECTION_ORDER) {
    const sectionAccounts = visible
      .filter((account) => account.pl_section === section)
      .sort((a, b) => a.display_order - b.display_order);

    const byName = new Map<string, PlAccount[]>();
    for (const account of sectionAccounts) {
      byName.set(account.name, [...(byName.get(account.name) ?? []), account]);
    }

    const accountNodes: PlNode[] = [];

    for (const [name, group] of byName) {
      const accountValues = zero(columns);
      const children: PlNode[] = [];

      for (const account of group) {
        const values = zero(columns);
        for (const fact of facts) {
          if (fact.accountId === account.id) values[fact.column] += fact.amount;
        }
        add(accountValues, values);

        // 補助科目が付いているときだけ 3 段目を作る
        if (account.sub_name) {
          children.push({ key: account.id, label: account.sub_name, values });
        }
      }

      accountNodes.push({
        key: `${section}-${name}`,
        label: name,
        values: accountValues,
        children: children.length > 0 ? children : undefined,
      });
      add(sectionTotals[section], accountValues);
    }

    // 科目が付いていない実績（売上・仕入れなど）はここにまとめる
    const unassigned = zero(columns);
    let hasUnassigned = false;
    for (const fact of facts) {
      if (fact.section !== section) continue;
      if (fact.accountId && byId.has(fact.accountId)) continue;
      unassigned[fact.column] += fact.amount;
      hasUnassigned = true;
    }
    if (hasUnassigned) {
      accountNodes.push({
        key: `${section}-unassigned`,
        label: '科目未設定',
        values: unassigned,
      });
      add(sectionTotals[section], unassigned);
    }

    nodes.push({
      key: section,
      label: PL_SECTION_LABELS[section],
      values: sectionTotals[section],
      children: accountNodes.length > 0 ? accountNodes : undefined,
      emphasis: true,
    });
  }

  // 営業利益 = 売上 − 原価 − 人件費 − 販売管理費
  const profit = zero(columns);
  for (const column of columns) {
    profit[column] =
      sectionTotals.sales[column] -
      sectionTotals.cogs[column] -
      sectionTotals.labor[column] -
      sectionTotals.sga[column];
  }

  nodes.push({ key: 'gross', label: '粗利益', values: grossOf(sectionTotals, columns), emphasis: true });
  nodes.push({ key: 'profit', label: '営業利益', values: profit, emphasis: true });

  return { nodes, profit };
}

function grossOf(
  totals: Record<PlSection, Record<string, number>>,
  columns: string[]
): Record<string, number> {
  const gross = zero(columns);
  for (const column of columns) {
    gross[column] = totals.sales[column] - totals.cogs[column];
  }
  return gross;
}
