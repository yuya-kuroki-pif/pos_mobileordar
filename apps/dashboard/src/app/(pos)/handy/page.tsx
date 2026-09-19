import { requireSession } from '@/lib/auth';
import { clone, db } from '@/lib/demo';
import { canEdit } from '@/lib/permissions';
import { isDemoMode, supabaseAdmin } from '@/lib/supabase';
import type { HandyTerminal } from '@/lib/types';

import { HandyView } from './HandyView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ハンディ管理' };

async function getTerminals(shopId: string): Promise<HandyTerminal[]> {
  if (isDemoMode()) {
    return clone(db().handyTerminals.filter((h) => h.shop_id === shopId));
  }

  const { data, error } = await supabaseAdmin()
    .from('handy_terminals')
    .select('*')
    .eq('shop_id', shopId)
    .order('registered_at');

  if (error) throw new Error(error.message);
  return (data ?? []) as HandyTerminal[];
}

/** ハンディ管理（仕様書 §5.18） */
export default async function HandyPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const currentShop = shops.find((s) => s.id === shop) ?? shops[0];
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  const terminals = currentShop ? await getTerminals(currentShop.id) : [];

  return (
    <HandyView
      shops={shops}
      shopId={currentShop?.id}
      terminals={terminals}
      companyName={companyName}
      editable={canEdit(session.permissions, 'shop_management')}
    />
  );
}
