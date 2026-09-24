/**
 * 追補（SPEC_ADDENDUM）§A.5 / §A.6 に載っている計算例をそのまま検算する。
 *
 * 税の端数と営業日の境界は、ずれても画面上は気づきにくく、
 * 伝票と CSV が合わなくなってから発覚する。仕様書の数字を固定しておく。
 *
 * 実行: npx tsx packages/pos-core/test/tax.test.ts
 */

import { unitTaxOf, calcLineTax, calcTax, calcSurcharge, requiresStamp } from '../src/tax';
import { businessDateOf } from '../src/businessDate';

let ng = 0;
const t = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) ng++;
  console.log((ok ? 'OK   ' : 'NG   ') + label + '   got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want));
};

console.log('--- 追補 §A.6.2 の計算例 ---');
t('内税 748円 10%', unitTaxOf(748, 'inclusive', 0.1), 68);
t('内税 748円 8% ', unitTaxOf(748, 'inclusive', 0.08), 55);
t('外税 100円 10%', unitTaxOf(100, 'exclusive', 0.1), 10);
t('外税 160円 8% ', unitTaxOf(160, 'exclusive', 0.08), 12);
t('748円8%を10点（明細単位で切捨て）', calcLineTax({ unitPrice: 748, quantity: 10, taxType: 'inclusive', taxRate: 0.08 }).taxAmount, 550);

const both = calcTax([
  { unitPrice: 439, quantity: 1, taxType: 'inclusive', taxRate: 0.1 },
  { unitPrice: 109, quantity: 1, taxType: 'inclusive', taxRate: 0.1 },
]);
t('本体+選択肢を別計算', both.taxTotal, 48);
t('（参考）548円を一括なら', unitTaxOf(548, 'inclusive', 0.1), 49);

t('割増 1315 × 10%', calcSurcharge(1315, 0.1), 131);
t('外税160円8%の税込', calcLineTax({ unitPrice: 160, quantity: 1, taxType: 'exclusive', taxRate: 0.08 }).totalAmount, 172);

const oos = calcTax([{ unitPrice: 1000, quantity: 1, taxType: 'out_of_scope', taxRate: 0 }]);
t('不課税の税額', oos.taxTotal, 0);
t('不課税の対象額', oos.outOfScope, 1000);

t('収入印紙 55000円現金', requiresStamp(55000, true), true);
t('収入印紙 54999円現金', requiresStamp(54999, true), false);
t('収入印紙 55000円カード', requiresStamp(55000, false), false);

console.log('--- 追補 §A.5 営業日（07:00 基準）---');
t('9/24 06:59 は前日', businessDateOf(new Date('2026-09-24T06:59:00+09:00')), '2026-09-23');
t('9/24 07:00 は当日', businessDateOf(new Date('2026-09-24T07:00:00+09:00')), '2026-09-24');
t('9/24 03:00 は前日', businessDateOf(new Date('2026-09-24T03:00:00+09:00')), '2026-09-23');
t('月またぎ 10/1 02:00', businessDateOf(new Date('2026-10-01T02:00:00+09:00')), '2026-09-30');

console.log(ng === 0 ? '\n=> 全部一致' : '\n=> ' + ng + ' 件ちがう');

if (ng > 0) process.exitCode = 1;
