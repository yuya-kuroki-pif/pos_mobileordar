import { requireSession } from '@/lib/auth';
import { getShopQuestionnaireSettings } from '@/lib/crmQueries';
import { canEdit } from '@/lib/permissions';

import { QuestionnaireSettingView } from './QuestionnaireSettingView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'アンケート設定' };

/** モバイルオーダーアンケート設定（仕様書 §5.31） */
export default async function QuestionnairePage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const settings = await getShopQuestionnaireSettings(shops.map((s) => s.id));

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <QuestionnaireSettingView
      shops={shops}
      settings={settings}
      companyName={companyName}
      editable={canEdit(session.permissions, 'crm')}
    />
  );
}
