import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  DiscountType,
  InflowSource,
  PaymentMethod,
  PaymentSettings,
  TerminalPaymentMethod,
} from './types';

/** 支払方法等設定（仕様書 §5.10）の 4 タブぶんをまとめて読む */
export async function getPaymentSettings(companyId: string): Promise<PaymentSettings> {
  if (isDemoMode()) {
    const state = db();
    const byOrder = <T extends { display_order: number }>(rows: T[]) =>
      clone(rows).sort((a, b) => a.display_order - b.display_order);

    return {
      methods: byOrder(state.paymentMethods.filter((m) => m.company_id === companyId)),
      discountTypes: byOrder(state.discountTypes.filter((d) => d.company_id === companyId)),
      inflowSources: byOrder(state.inflowSources.filter((i) => i.company_id === companyId)),
      terminals: byOrder(
        state.terminalPaymentMethods.filter((t) => t.company_id === companyId)
      ),
    };
  }

  const supabase = supabaseAdmin();

  const [methodRes, discountRes, inflowRes, terminalRes] = await Promise.all([
    supabase.from('payment_methods').select('*').eq('company_id', companyId).order('display_order'),
    supabase.from('discount_types').select('*').eq('company_id', companyId).order('display_order'),
    supabase.from('inflow_sources').select('*').eq('company_id', companyId).order('display_order'),
    supabase
      .from('terminal_payment_methods')
      .select('*')
      .eq('company_id', companyId)
      .order('display_order'),
  ]);

  for (const res of [methodRes, discountRes, inflowRes, terminalRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  return {
    methods: (methodRes.data ?? []) as PaymentMethod[],
    discountTypes: (discountRes.data ?? []) as DiscountType[],
    inflowSources: (inflowRes.data ?? []) as InflowSource[],
    terminals: (terminalRes.data ?? []) as TerminalPaymentMethod[],
  };
}
