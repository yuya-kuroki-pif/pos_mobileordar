import 'server-only';

import QRCode from 'qrcode';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type { Area, RestaurantTable } from './types';

/** テーブル画面（仕様書 §5.19）が必要とする一式 */
export interface TableBoard {
  areas: Area[];
  tables: RestaurantTable[];
}

export async function getTableBoard(shopId: string): Promise<TableBoard> {
  if (isDemoMode()) {
    const state = db();
    return {
      areas: clone(state.areas.filter((a) => a.shop_id === shopId)).sort(
        (a, b) => a.display_order - b.display_order
      ),
      tables: clone(state.restaurantTables.filter((t) => t.store_id === shopId)).sort(
        (a, b) => a.sort_order - b.sort_order
      ),
    };
  }

  const supabase = supabaseAdmin();

  const [areaRes, tableRes] = await Promise.all([
    supabase.from('areas').select('*').eq('shop_id', shopId).order('display_order'),
    supabase.from('restaurant_tables').select('*').eq('store_id', shopId).order('sort_order'),
  ]);

  if (areaRes.error) throw new Error(areaRes.error.message);
  if (tableRes.error) throw new Error(tableRes.error.message);

  return {
    areas: (areaRes.data ?? []) as Area[],
    tables: (tableRes.data ?? []) as RestaurantTable[],
  };
}

/** モバイルオーダーの起動 URL（仕様書 §5.19） */
export function moUrl(shopId: string, tableId: string, token: string | null): string {
  const base = process.env.NEXT_PUBLIC_MO_BASE_URL ?? 'http://localhost:3001';
  return `${base}/?shopId=${shopId}&tableId=${tableId}&token=${token ?? ''}`;
}

/** QR コードを data URL にする。画面へは画像として渡す */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 240, margin: 1 });
}
