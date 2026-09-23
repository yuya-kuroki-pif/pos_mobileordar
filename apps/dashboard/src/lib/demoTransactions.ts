import 'server-only';

import type {
  AuditEvent,
  AuditLog,
  BankDepositCorrection,
  CashClosing,
  Menu,
  OrderItemRecord,
  OrderRecord,
  PaymentRecord,
  TableSession,
  TerminalDeposit,
  TerminalPayment,
} from './types';

/**
 * デモ用の取引データ（仕様書 §5.22〜§5.28、および §6 の分析用）。
 *
 * 見た目を確かめるためのものなので、乱数は固定の種から作って
 * サーバーを再起動しても同じ並びになるようにしている。
 */

export interface TransactionState {
  tableSessions: TableSession[];
  orderRecords: OrderRecord[];
  orderItemRecords: OrderItemRecord[];
  paymentRecords: PaymentRecord[];
  auditLogs: AuditLog[];
  cashClosings: CashClosing[];
  bankDepositCorrections: BankDepositCorrection[];
  terminalPayments: TerminalPayment[];
  terminalDeposits: TerminalDeposit[];
}

/** 線形合同法。値が散らばればよいので簡単なもので済ませる */
function makeRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

function pick<T>(random: () => number, list: T[]): T {
  return list[Math.floor(random() * list.length)];
}

/** 営業日の文字列（YYYY-MM-DD） */
function businessDay(base: Date, daysAgo: number): string {
  const date = new Date(base);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function at(day: string, hour: number, minute: number): string {
  return `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
}

export interface TransactionSeedInput {
  corporationId: string;
  shops: { id: string; company_id: string }[];
  menus: Menu[];
  tableIdsByShop: Record<string, string[]>;
  clerkIdsByShop: Record<string, string[]>;
  paymentMethodsByCompany: Record<string, { id: string; name: string; kind: string }[]>;
  inflowSourceIdsByCompany: Record<string, string[]>;
  /** メニューに紐づくオプション。注文明細の options_snapshot を作るのに使う */
  optionsByMenu: Record<string, { group: string; choices: { name: string; price: number }[] }[]>;
  /** 何日ぶん作るか */
  days: number;
}

export function buildTransactions(input: TransactionSeedInput): TransactionState {
  const random = makeRandom(20260919);
  const today = new Date('2026-09-19T00:00:00+09:00');

  const tableSessions: TableSession[] = [];
  const orderRecords: OrderRecord[] = [];
  const orderItemRecords: OrderItemRecord[] = [];
  const paymentRecords: PaymentRecord[] = [];
  const auditLogs: AuditLog[] = [];
  const cashClosings: CashClosing[] = [];
  const bankDepositCorrections: BankDepositCorrection[] = [];
  const terminalPayments: TerminalPayment[] = [];

  let receiptNumber = 1000;

  for (const shop of input.shops) {
    const menus = input.menus.filter((menu) => menu.company_id === shop.company_id);
    if (menus.length === 0) continue;

    const tableIds = input.tableIdsByShop[shop.id] ?? [];
    const clerkIds = input.clerkIdsByShop[shop.id] ?? [];
    const methods = input.paymentMethodsByCompany[shop.company_id] ?? [];
    const inflowIds = input.inflowSourceIdsByCompany[shop.company_id] ?? [];

    for (let daysAgo = input.days - 1; daysAgo >= 0; daysAgo -= 1) {
      const day = businessDay(today, daysAgo);
      const weekday = new Date(`${day}T00:00:00+09:00`).getDay();

      // 金土は組数を増やす
      const base = weekday === 5 || weekday === 6 ? 14 : 9;
      const groupCount = base + Math.floor(random() * 5);

      let cashSales = 0;
      let totalSales = 0;
      let guestTotal = 0;

      for (let g = 0; g < groupCount; g += 1) {
        const hour = 17 + Math.floor(random() * 5);
        const minute = Math.floor(random() * 60);
        const guests = 1 + Math.floor(random() * 4);
        guestTotal += guests;

        const sessionId = `${shop.id}-${day}-s${g}`;
        const openedAt = at(day, hour, minute);
        const closedAt = at(day, Math.min(hour + 1, 23), minute);

        tableSessions.push({
          id: sessionId,
          store_id: shop.id,
          table_id: tableIds.length > 0 ? pick(random, tableIds) : null,
          parent_session_id: null,
          guest_count: guests,
          status: 'closed',
          opened_at: openedAt,
          closed_at: closedAt,
          clear_reason: null,
          inflow_source_id: inflowIds.length > 0 ? pick(random, inflowIds) : null,
        });

        // 1 卓につき 1〜2 回の注文
        const orderCount = 1 + Math.floor(random() * 2);
        let subtotal = 0;
        let tax = 0;

        for (let o = 0; o < orderCount; o += 1) {
          const orderId = `${sessionId}-o${o}`;
          const placedAt = at(day, hour, Math.min(minute + o * 10, 59));
          orderRecords.push({
            id: orderId,
            store_id: shop.id,
            session_id: sessionId,
            order_number: o + 1,
            channel: random() > 0.4 ? 'mobile' : 'handy',
            placed_at: placedAt,
          });

          const itemCount = 2 + Math.floor(random() * 4);
          for (let i = 0; i < itemCount; i += 1) {
            const menu = pick(random, menus);
            const quantity = 1 + Math.floor(random() * 2);
            const lineTotal = menu.price * quantity;

            subtotal += lineTotal;
            tax += Math.round((lineTotal * menu.tax_rate) / (1 + menu.tax_rate));

            // KDS の打刻。ドリンクは早く、フードは時間がかかる想定で散らす
            const cookMin = menu.menu_type === 'drink' ? 1 + random() * 3 : 5 + random() * 12;
            const pickMin = 0.5 + random() * 2.5;
            const serveMin = 0.5 + random() * 2;
            const plus = (base: string, minutes: number) =>
              new Date(Date.parse(base) + minutes * 60000).toISOString();
            const cookedAt = plus(placedAt, cookMin);
            const pickedUpAt = plus(cookedAt, pickMin);

            // オプションは、付いているメニューの 6 割くらいで選ばれる想定
            const optionGroups = input.optionsByMenu[menu.id] ?? [];
            const chosen = optionGroups
              .filter(() => random() > 0.4)
              .map((group) => {
                const choice = pick(random, group.choices);
                return { group: group.group, name: choice.name, price_delta: choice.price };
              });

            orderItemRecords.push({
              id: `${orderId}-i${i}`,
              order_id: orderId,
              session_id: sessionId,
              menu_id: menu.id,
              name_snapshot: menu.name,
              unit_price: menu.price,
              quantity,
              tax_rate: menu.tax_rate,
              line_total: lineTotal,
              status: 'served',
              options_snapshot: chosen,
              cooked_at: cookedAt,
              picked_up_at: pickedUpAt,
              served_at: plus(pickedUpAt, serveMin),
            });
          }
        }

        const method = methods.length > 0 ? pick(random, methods) : null;
        const isCash = method?.kind === 'cash';
        const paymentId = `${sessionId}-p`;
        receiptNumber += 1;

        // 2 割くらいの会計に端数値引きを付ける
        const discount = random() > 0.8 ? Math.floor(subtotal * 0.05) : 0;
        const total = subtotal - discount;

        paymentRecords.push({
          id: paymentId,
          store_id: shop.id,
          session_id: sessionId,
          method: method?.kind ?? 'cash',
          payment_method_id: method?.id ?? null,
          receipt_number: receiptNumber,
          clerk_id: clerkIds.length > 0 ? pick(random, clerkIds) : null,
          guest_count: guests,
          inflow_source_id: inflowIds.length > 0 ? pick(random, inflowIds) : null,
          subtotal,
          discount,
          service_charge: 0,
          tax,
          total,
          status: 'paid',
          paid_at: closedAt,
          voided_at: null,
          void_reason: null,
          modified_at: null,
        });

        totalSales += total;
        if (isCash) cashSales += total;
        else {
          const fee = Math.round(total * 0.0248);
          terminalPayments.push({
            id: `${paymentId}-tp`,
            shop_id: shop.id,
            transaction_id: `TX${receiptNumber}`,
            kind: '売上',
            method: method?.name ?? 'クレジット',
            status: 'captured',
            occurred_at: closedAt,
            amount: total,
            fee,
            fee_rate: 0.0248,
            net: total - fee,
            brand: pick(random, ['Visa', 'Mastercard', 'JCB', 'PayPay']),
            issuer_country: 'JP',
            masked_pan: `**** **** **** ${1000 + Math.floor(random() * 8999)}`,
            cycle_start: day.slice(0, 8) + '01',
            cycle_end: day.slice(0, 8) + '15',
            refund_requested_at: null,
          });
        }

        if (discount > 0) {
          auditLogs.push({
            id: `${paymentId}-audit`,
            shop_id: shop.id,
            event_type: 'discount',
            occurred_at: closedAt,
            table_id: null,
            clerk_id: clerkIds.length > 0 ? pick(random, clerkIds) : null,
            amount: discount,
            receipt_number: receiptNumber,
            note: '端数値引',
          });
        }
      }

      // その日のレジ締め
      const openingFloat = 30000;
      const cashIn = Math.floor(random() * 3) * 5000;
      const cashOut = Math.floor(random() * 2) * 3000;
      const expected = openingFloat + cashSales + cashIn - cashOut;
      // たまに過不足を出す
      const drift = random() > 0.85 ? (random() > 0.5 ? 100 : -100) : 0;
      const counted = expected + drift;
      const bankDeposit = Math.max(0, counted - openingFloat);

      const closingId = `${shop.id}-${day}-close`;
      cashClosings.push({
        id: closingId,
        store_id: shop.id,
        business_day: day,
        closing_index: 0,
        closed_at: at(day, 23, 55),
        total_sales: totalSales,
        guest_count: guestTotal,
        group_count: groupCount,
        opening_float: openingFloat,
        cash_sales: cashSales,
        cash_in: cashIn,
        cash_out: cashOut,
        expected_cash: expected,
        counted_cash: counted,
        difference: drift,
        bank_deposit: bankDeposit,
        carryover_fund: openingFloat,
        denomination_counts: {
          '10000': Math.floor(counted / 10000),
          '5000': Math.floor((counted % 10000) / 5000),
          '1000': Math.floor((counted % 5000) / 1000),
          '500': Math.floor((counted % 1000) / 500),
          '100': Math.floor((counted % 500) / 100),
          '50': Math.floor((counted % 100) / 50),
          '10': Math.floor((counted % 50) / 10),
          '5': Math.floor((counted % 10) / 5),
          '1': counted % 5,
        },
      });

      if (cashIn > 0) {
        auditLogs.push({
          id: `${closingId}-in`,
          shop_id: shop.id,
          event_type: 'cash_in',
          occurred_at: at(day, 20, 0),
          table_id: null,
          clerk_id: clerkIds.length > 0 ? pick(random, clerkIds) : null,
          amount: cashIn,
          receipt_number: null,
          note: '釣銭補充',
        });
      }

      auditLogs.push({
        id: `${closingId}-drawer`,
        shop_id: shop.id,
        event_type: 'drawer_open' as AuditEvent,
        occurred_at: at(day, 17, 0),
        table_id: null,
        clerk_id: clerkIds.length > 0 ? pick(random, clerkIds) : null,
        amount: null,
        receipt_number: null,
        note: '開店準備',
      });
    }
  }

  // 銀行預入金の修正は、直近の締めに 1 件だけ入れておく
  const latest = cashClosings[cashClosings.length - 1];
  if (latest) {
    bankDepositCorrections.push({
      id: `${latest.id}-fix`,
      closing_id: latest.id,
      corrected_at: at(latest.business_day, 23, 59),
      reason: '数え直したため',
      before_amount: latest.bank_deposit,
      after_amount: latest.bank_deposit + 1000,
      account_id: null,
    });
  }

  // 入金履歴（§5.24）。月 2 回振込を前提に、決済ぶんを締め日でまとめる
  const cycles = [
    { start: 16, end: 31, label: '後半' },
    { start: 1, end: 15, label: '前半' },
  ];
  const terminalDeposits: TerminalDeposit[] = cycles.map((cycle, index) => {
    const inCycle = terminalPayments.filter((payment) => {
      const day = Number(payment.occurred_at.slice(8, 10));
      return day >= cycle.start && day <= cycle.end;
    });
    const sales = inCycle.reduce((sum, p) => sum + p.amount, 0);
    const fee = inCycle.reduce((sum, p) => sum + p.fee, 0);
    const tax = Math.round(fee * 0.1);
    const month = businessDay(today, 0).slice(0, 7);

    return {
      id: `deposit-${index}`,
      corporation_id: input.corporationId,
      requested_at: at(`${month}-${String(cycle.end === 31 ? 28 : 18).padStart(2, '0')}`, 10, 0),
      executed_at:
        index === 0 ? null : at(`${month}-${String(cycle.end === 31 ? 28 : 25).padStart(2, '0')}`, 10, 0),
      bank_account: '三井住友銀行 ****1234',
      cycle_start: `${month}-${String(cycle.start).padStart(2, '0')}`,
      cycle_end: `${month}-${String(Math.min(cycle.end, 28)).padStart(2, '0')}`,
      amount: sales - fee - tax,
      sales,
      fee,
      tax,
      adjustment: 0,
      carryover: 0,
      cycle_type: '月2回振込',
      status: index === 0 ? '入金予定' : '入金済み',
      statement_no: `ST-2026${String(index + 1).padStart(4, '0')}`,
    };
  });

  return {
    tableSessions,
    orderRecords,
    orderItemRecords,
    paymentRecords,
    auditLogs,
    cashClosings,
    bankDepositCorrections,
    terminalPayments,
    terminalDeposits,
  };
}
