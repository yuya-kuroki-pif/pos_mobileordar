import 'server-only';

import { db, clone } from './demo';
import { toShop } from './shopRow';
import { isDemoMode, supabaseAdmin } from './supabase';
import type { BusinessHour, Shop } from './types';

/** 店舗編集が必要とする一式（仕様書 §5.12 の 4 タブぶん） */
export interface ShopDetail {
  shop: Shop;
  businessHours: BusinessHour[];
}

export async function getShopDetail(shopId: string): Promise<ShopDetail | null> {
  if (isDemoMode()) {
    const state = db();
    const shop = state.shops.find((s) => s.id === shopId);
    if (!shop) return null;

    return {
      shop: clone(shop),
      businessHours: clone(state.businessHours.filter((b) => b.shop_id === shopId)).sort(
        (a, b) => a.display_order - b.display_order,
      ),
    };
  }

  const db2 = supabaseAdmin();

  const [shopRes, hourRes] = await Promise.all([
    db2.from('shops').select('*').eq('id', shopId).maybeSingle(),
    db2.from('business_hours').select('*').eq('shop_id', shopId).order('display_order'),
  ]);

  if (shopRes.error) throw new Error(shopRes.error.message);
  if (hourRes.error) throw new Error(hourRes.error.message);
  if (!shopRes.data) return null;

  return {
    shop: toShop(shopRes.data as Record<string, unknown>),
    businessHours: (hourRes.data ?? []) as BusinessHour[],
  };
}
