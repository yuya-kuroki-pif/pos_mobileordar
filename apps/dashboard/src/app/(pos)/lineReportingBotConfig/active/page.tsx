import { requireSession } from '@/lib/auth';
import { clone, db } from '@/lib/demo';
import { canEdit } from '@/lib/permissions';
import { isDemoMode, supabaseAdmin } from '@/lib/supabase';
import type { LineReportingBotConfig } from '@/lib/types';

import { BotConfigView } from './BotConfigView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'レポートくん設定' };

async function getConfigs(corporationId: string): Promise<LineReportingBotConfig[]> {
  if (isDemoMode()) return clone(db().lineReportingBotConfigs);

  const { data, error } = await supabaseAdmin()
    .from('line_reporting_bot_configs')
    .select('*')
    .eq('corporation_id', corporationId)
    .order('created_at');

  if (error) throw new Error(error.message);
  return (data ?? []) as LineReportingBotConfig[];
}

/** レポートくん設定（仕様書 §5.27） */
export default async function BotConfigPage() {
  const session = await requireSession();
  const configs = await getConfigs(session.corporation.id);

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <BotConfigView
      configs={configs}
      shops={shops}
      companyName={companyName}
      editable={canEdit(session.permissions, 'analytics')}
    />
  );
}
