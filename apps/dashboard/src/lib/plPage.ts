import 'server-only';

import { getShopSummaries, type Range } from './analyticsQueries';
import { getPlAccounts, getPurchases } from './biQueries';
import { buildPlTree, getPlTransactions, type PlFact, type PlNode } from './plTree';

/**
 * PL の 3 画面（店舗別 §6.2 / 店舗 月別 / 店舗 日別）で共通の組み立て。
 * 列の切り方だけが違うので、実績を「どの列に入れるか」を関数で渡してもらう。
 */
export async function loadPlTree(input: {
  corporationId: string;
  /** 列の並び。ここに無い列に落ちた実績は捨てる */
  columns: { key: string; label: string }[];
  /** 列ごとに「どの店舗の、いつからいつまでか」を決める */
  slices: { column: string; shopIds: string[]; range: Range }[];
}): Promise<{ nodes: PlNode[]; profit: Record<string, number> }> {
  const { corporationId, columns, slices } = input;

  const accounts = await getPlAccounts(corporationId);
  const columnKeys = columns.map((column) => column.key);
  const facts: PlFact[] = [];

  for (const { column, shopIds, range } of slices) {
    if (!columnKeys.includes(column)) continue;

    const [summaries, purchases, transactions] = await Promise.all([
      getShopSummaries(shopIds, range),
      getPurchases(shopIds, range.from, range.to),
      getPlTransactions(shopIds, range.from, range.to),
    ]);

    // 売上は会計から。売上の科目（POS売上）があればそこへ、無ければ科目未設定へ
    const sales = summaries.reduce((sum, row) => sum + row.sales, 0);
    const salesAccount =
      accounts.find((a) => a.pl_section === 'sales' && a.sub_name === 'POS売上') ??
      accounts.find((a) => a.pl_section === 'sales');

    if (sales !== 0) {
      facts.push({ column, accountId: salesAccount?.id ?? null, section: 'sales', amount: sales });
    }

    // 仕入れはフード / ドリンクで科目を分ける
    const food = purchases
      .filter((row) => row.product_type === 'food')
      .reduce((sum, row) => sum + row.amount, 0);
    const drink = purchases
      .filter((row) => row.product_type === 'drink')
      .reduce((sum, row) => sum + row.amount, 0);

    const foodAccount = accounts.find((a) => a.pl_section === 'cogs' && a.sub_name === 'フード');
    const drinkAccount = accounts.find((a) => a.pl_section === 'cogs' && a.sub_name === 'ドリンク');

    if (food !== 0) {
      facts.push({ column, accountId: foodAccount?.id ?? null, section: 'cogs', amount: food });
    }
    if (drink !== 0) {
      facts.push({ column, accountId: drinkAccount?.id ?? null, section: 'cogs', amount: drink });
    }

    // 収支登録・小口現金は科目がそのまま付いている
    for (const row of transactions) {
      const account = accounts.find((a) => a.id === row.pl_account_id);
      if (!account) continue;
      facts.push({
        column,
        accountId: account.id,
        section: account.pl_section,
        amount: row.amount,
      });
    }
  }

  return buildPlTree(accounts, facts, columnKeys);
}
