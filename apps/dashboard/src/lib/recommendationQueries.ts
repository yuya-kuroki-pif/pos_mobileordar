import 'server-only';

import { clone, db } from './demo';
import { isDemoMode, supabaseAdmin } from './supabase';
import type { RecommendationSet, ShopRecommendation } from './types';

/** おすすめメニュー（仕様書 §5.7）が必要とする一式 */
export interface RecommendationBoard {
  sets: (RecommendationSet & { menu_ids: string[]; menu_names: string[] })[];
  shopLinks: ShopRecommendation[];
}

export async function getRecommendationBoard(
  companyId: string,
  shopIds: string[]
): Promise<RecommendationBoard> {
  if (isDemoMode()) {
    const state = db();
    const sets = state.recommendationSets.filter((s) => s.company_id === companyId);

    return {
      sets: clone(sets)
        .sort((a, b) => a.display_order - b.display_order)
        .map((set) => {
          const links = state.recommendationMenus
            .filter((l) => l.set_id === set.id)
            .sort((a, b) => a.display_order - b.display_order);
          return {
            ...set,
            menu_ids: links.map((l) => l.menu_id),
            menu_names: links.map(
              (l) => state.menus.find((m) => m.id === l.menu_id)?.name ?? ''
            ),
          };
        }),
      shopLinks: clone(state.shopRecommendations.filter((l) => shopIds.includes(l.shop_id))),
    };
  }

  const supabase = supabaseAdmin();

  const [setRes, linkRes, menuRes, shopRes] = await Promise.all([
    supabase
      .from('recommendation_sets')
      .select('*')
      .eq('company_id', companyId)
      .order('display_order'),
    supabase.from('recommendation_menus').select('*').order('display_order'),
    supabase.from('menus').select('id, name').eq('company_id', companyId),
    shopIds.length > 0
      ? supabase.from('shop_recommendations').select('*').in('shop_id', shopIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const res of [setRes, linkRes, menuRes, shopRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const links = (linkRes.data ?? []) as { set_id: string; menu_id: string }[];
  const menuName = new Map(
    ((menuRes.data ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name])
  );

  return {
    sets: ((setRes.data ?? []) as RecommendationSet[]).map((set) => {
      const own = links.filter((l) => l.set_id === set.id);
      return {
        ...set,
        menu_ids: own.map((l) => l.menu_id),
        menu_names: own
          .map((l) => menuName.get(l.menu_id))
          .filter((name): name is string => Boolean(name)),
      };
    }),
    shopLinks: (shopRes.data ?? []) as ShopRecommendation[],
  };
}
