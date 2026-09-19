import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type {
  AutoTranslationSetting,
  CashChangerSetting,
  CompulsoryAppetizer,
  MobileOrderDesign,
  ShopAppetizer,
} from './types';

/** 自動翻訳設定（仕様書 §5.9）。行が無ければ既定値を返す */
export async function getAutoTranslationSetting(
  companyId: string
): Promise<AutoTranslationSetting> {
  const fallback: AutoTranslationSetting = {
    company_id: companyId,
    is_enabled: false,
    target_menu: true,
    target_plan: true,
    target_option: true,
    target_category: true,
    target_recommendation: true,
  };

  if (isDemoMode()) {
    const row = db().autoTranslationSettings.find((s) => s.company_id === companyId);
    return row ? clone(row) : fallback;
  }

  const { data, error } = await supabaseAdmin()
    .from('auto_translation_settings')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as AutoTranslationSetting | null) ?? fallback;
}

/** モバイルオーダーデザイン設定（仕様書 §5.11） */
export async function getMobileOrderDesign(companyId: string): Promise<MobileOrderDesign> {
  const fallback: MobileOrderDesign = {
    company_id: companyId,
    menu_theme: 'light',
    checkin_theme: 'light',
  };

  if (isDemoMode()) {
    const row = db().mobileOrderDesigns.find((d) => d.company_id === companyId);
    return row ? clone(row) : fallback;
  }

  const { data, error } = await supabaseAdmin()
    .from('mobile_order_designs')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as MobileOrderDesign | null) ?? fallback;
}

/** 自動釣銭機設定（仕様書 §5.9）。店舗ごとに 1 行 */
export async function getCashChangerSettings(
  shopIds: string[]
): Promise<CashChangerSetting[]> {
  const fallback = (shopId: string): CashChangerSetting => ({
    shop_id: shopId,
    keep_float_in_changer: false,
    allow_external_deposit: false,
    allow_emergency_cash: false,
  });

  if (shopIds.length === 0) return [];

  if (isDemoMode()) {
    const rows = db().cashChangerSettings;
    return shopIds.map((id) => {
      const row = rows.find((r) => r.shop_id === id);
      return row ? clone(row) : fallback(id);
    });
  }

  const { data, error } = await supabaseAdmin()
    .from('cash_changer_settings')
    .select('*')
    .in('shop_id', shopIds);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CashChangerSetting[];
  return shopIds.map((id) => rows.find((r) => r.shop_id === id) ?? fallback(id));
}

/** お通し自動設定（仕様書 §5.9） */
export interface AppetizerBoard {
  appetizers: CompulsoryAppetizer[];
  shopLinks: ShopAppetizer[];
}

export async function getAppetizerBoard(
  companyId: string,
  shopIds: string[]
): Promise<AppetizerBoard> {
  if (isDemoMode()) {
    const state = db();
    return {
      appetizers: clone(
        state.compulsoryAppetizers.filter((a) => a.company_id === companyId)
      ).sort((a, b) => a.display_order - b.display_order),
      shopLinks: clone(state.shopAppetizers.filter((l) => shopIds.includes(l.shop_id))),
    };
  }

  const supabase = supabaseAdmin();

  const [apRes, linkRes] = await Promise.all([
    supabase
      .from('compulsory_appetizers')
      .select('*')
      .eq('company_id', companyId)
      .order('display_order'),
    shopIds.length > 0
      ? supabase.from('shop_appetizers').select('*').in('shop_id', shopIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (apRes.error) throw new Error(apRes.error.message);
  if (linkRes.error) throw new Error(linkRes.error.message);

  return {
    appetizers: (apRes.data ?? []) as CompulsoryAppetizer[],
    shopLinks: (linkRes.data ?? []) as ShopAppetizer[],
  };
}
