import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  DailyReport,
  DailySalesTarget,
  KpiTarget,
  PlAccount,
  PurchaseTransaction,
  Vendor,
} from './types';

/** 経営管理まわりの読み取り（仕様書 §6.x） */

export async function getKpiTargets(shopIds: string[], yearMonth: string): Promise<KpiTarget[]> {
  if (shopIds.length === 0) return [];

  if (isDemoMode()) {
    return clone(db().kpiTargets.filter((t) => shopIds.includes(t.shop_id) && t.year_month === yearMonth));
  }

  const { data, error } = await supabaseAdmin()
    .from('kpi_targets')
    .select('*')
    .in('shop_id', shopIds)
    .eq('year_month', yearMonth);

  if (error) throw new Error(error.message);
  return (data ?? []) as KpiTarget[];
}

export async function getDailyTargetRows(
  shopId: string,
  yearMonth: string
): Promise<DailySalesTarget[]> {
  if (isDemoMode()) {
    return clone(
      db().dailySalesTargets.filter(
        (t) => t.shop_id === shopId && t.business_date.slice(0, 7) === yearMonth
      )
    );
  }

  const { data, error } = await supabaseAdmin()
    .from('daily_sales_targets')
    .select('*')
    .eq('shop_id', shopId)
    .gte('business_date', `${yearMonth}-01`)
    .lte('business_date', `${yearMonth}-31`);

  if (error) throw new Error(error.message);
  return (data ?? []) as DailySalesTarget[];
}

export async function getPlAccounts(corporationId: string): Promise<PlAccount[]> {
  if (isDemoMode()) return clone(db().plAccounts);

  const { data, error } = await supabaseAdmin()
    .from('pl_accounts')
    .select('*')
    .eq('corporation_id', corporationId)
    .order('display_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as PlAccount[];
}

export async function getVendors(corporationId: string): Promise<Vendor[]> {
  if (isDemoMode()) return clone(db().vendors);

  const { data, error } = await supabaseAdmin()
    .from('vendors')
    .select('*')
    .eq('corporation_id', corporationId)
    .order('display_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as Vendor[];
}

export async function getPurchases(
  shopIds: string[],
  from: string,
  to: string
): Promise<PurchaseTransaction[]> {
  if (shopIds.length === 0) return [];

  if (isDemoMode()) {
    return clone(
      db().purchaseTransactions.filter(
        (p) => shopIds.includes(p.shop_id) && p.purchased_on >= from && p.purchased_on <= to
      )
    ).sort((a, b) => (a.purchased_on < b.purchased_on ? 1 : -1));
  }

  const { data, error } = await supabaseAdmin()
    .from('purchase_transactions')
    .select('*')
    .in('shop_id', shopIds)
    .gte('purchased_on', from)
    .lte('purchased_on', to)
    .order('purchased_on', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PurchaseTransaction[];
}

export async function getDailyReport(
  shopId: string,
  businessDate: string
): Promise<DailyReport | null> {
  if (isDemoMode()) {
    return (
      clone(
        db().dailyReports.find((r) => r.shop_id === shopId && r.business_date === businessDate)
      ) ?? null
    );
  }

  const { data, error } = await supabaseAdmin()
    .from('daily_reports')
    .select('*')
    .eq('shop_id', shopId)
    .eq('business_date', businessDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as DailyReport | null) ?? null;
}
