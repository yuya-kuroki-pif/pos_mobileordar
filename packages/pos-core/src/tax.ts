/**
 * 消費税の計算（追補 §A.6.1 / §A.6.2）。
 *
 * 大事なところ:
 * - **明細 1 行ごとに切捨て**て、そのあと数量倍する。
 *   会計の合計に対して一度に計算すると端数が合わなくなる。
 *   例: 748 円 8% を 10 点 → 55 × 10 = 550 円（7,480 円まとめて計算すると 553 円）
 * - **選択肢は本体と別計算**。
 *   例: 税込 548 円 = 本体 439 円 + トッピング 109 円 → 39 + 9 = 48 円
 *   （548 円まとめてなら 49 円になるが、採用しない）
 * - 非課税・不課税は税額 0。ただし総売上・純売上には含める。
 */

/** 税種別。不課税は推しエール・チップ専用で、メニューには設定できない */
export type TaxType = 'inclusive' | 'exclusive' | 'non_taxable' | 'out_of_scope';

/** 税率は 10% / 8% / 0% のみ（追補 §A.6.1） */
export type TaxRate = 0.1 | 0.08 | 0;

/** 計算式のバージョン。式を変えたらここを上げ、過去の伝票は当時の値で再現する */
export const CALC_VERSION = 1;

export interface TaxableLine {
  /** 単価（内税なら税込、外税なら税抜） */
  unitPrice: number;
  quantity: number;
  taxType: TaxType;
  taxRate: TaxRate;
}

export interface LineTax {
  /** 単価 1 個あたりの税額（切捨て後） */
  unitTax: number;
  /** 明細の税額 = unitTax * quantity */
  taxAmount: number;
  /** 明細の税抜金額 */
  baseAmount: number;
  /** 明細の税込金額 */
  totalAmount: number;
}

/**
 * 単価 1 個ぶんの税額。切捨て。
 * 内税は価格に税が含まれているので割り戻し、外税は価格に掛ける。
 *
 * 小数のまま掛けると誤差が出る（748 * 0.1 / 1.1 は 67.999… になり 67 になってしまう）ので、
 * 追補 §A.6.3 の指示どおり整数だけで計算する。税率は % の整数に直してから使う。
 */
export function unitTaxOf(unitPrice: number, taxType: TaxType, taxRate: TaxRate): number {
  if (taxType === 'non_taxable' || taxType === 'out_of_scope' || taxRate === 0) return 0;

  const percent = Math.round(taxRate * 100); // 0.1 → 10 / 0.08 → 8

  if (taxType === 'inclusive') {
    // 748 円 10% → floor(748 * 10 / 110) = 68
    return Math.floor((unitPrice * percent) / (100 + percent));
  }

  // 外税 100 円 10% → floor(100 * 10 / 100) = 10
  return Math.floor((unitPrice * percent) / 100);
}

/** 明細 1 行の税と金額 */
export function calcLineTax(line: TaxableLine): LineTax {
  const unitTax = unitTaxOf(line.unitPrice, line.taxType, line.taxRate);
  const taxAmount = unitTax * line.quantity;

  // 内税は単価に税が入っている。外税は単価に税を足したものが税込
  const unitTotal = line.taxType === 'exclusive' ? line.unitPrice + unitTax : line.unitPrice;
  const totalAmount = unitTotal * line.quantity;

  return {
    unitTax,
    taxAmount,
    baseAmount: totalAmount - taxAmount,
    totalAmount,
  };
}

export interface TaxBreakdown {
  /** 税率別の内訳。伝票の税率別セクションにそのまま出せる */
  rate10: { base: number; tax: number };
  rate8: { base: number; tax: number };
  /** 非課税の対象額 */
  nonTaxable: number;
  /** 不課税の対象額（推しエール・チップ） */
  outOfScope: number;
  /** 税額の合計 */
  taxTotal: number;
  /** 税込の合計 */
  total: number;
}

/**
 * 明細をまとめて税率別の内訳にする。
 * 本体と選択肢は呼び出し側で別々の行として渡すこと（別計算のため）。
 */
export function calcTax(lines: TaxableLine[]): TaxBreakdown {
  const result: TaxBreakdown = {
    rate10: { base: 0, tax: 0 },
    rate8: { base: 0, tax: 0 },
    nonTaxable: 0,
    outOfScope: 0,
    taxTotal: 0,
    total: 0,
  };

  for (const line of lines) {
    const calc = calcLineTax(line);
    result.total += calc.totalAmount;
    result.taxTotal += calc.taxAmount;

    if (line.taxType === 'out_of_scope') {
      result.outOfScope += calc.totalAmount;
    } else if (line.taxType === 'non_taxable' || line.taxRate === 0) {
      result.nonTaxable += calc.totalAmount;
    } else if (line.taxRate === 0.1) {
      result.rate10.base += calc.baseAmount;
      result.rate10.tax += calc.taxAmount;
    } else {
      result.rate8.base += calc.baseAmount;
      result.rate8.tax += calc.taxAmount;
    }
  }

  return result;
}

/**
 * 割増（タイムチャージ・サービス料）。内税で、卓を立ち上げたときに自動で付く。
 * 推しエール・チップには付かない（追補 §A.6.2）。
 */
export function calcSurcharge(subtotal: number, rate: number): number {
  return Math.floor(subtotal * rate);
}

/**
 * チップ（追補 §A.6.2 / §D.5）。
 * 推しエール・サービス料・タイムチャージを除いた小計に料率を掛けて切捨て。不課税。
 */
export function calcTip(subtotalExcludingSurcharge: number, tipRate: number): number {
  return Math.floor(subtotalExcludingSurcharge * tipRate);
}

/** 収入印紙が要るか（税込 55,000 円以上かつ現金系。追補 §A.6.3） */
export function requiresStamp(total: number, isCashLike: boolean): boolean {
  return isCashLike && total >= 55000;
}
