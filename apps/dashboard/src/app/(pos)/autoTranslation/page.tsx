import { isAiConfigured } from '@/lib/anthropic';
import { requireSession } from '@/lib/auth';
import { getAutoTranslationSetting } from '@/lib/companyQueries';
import { canEdit } from '@/lib/permissions';

import { AutoTranslationForm } from './AutoTranslationForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '自動翻訳設定' };

/** 自動翻訳設定（仕様書 §5.9） */
export default async function AutoTranslationPage() {
  const session = await requireSession();
  const setting = await getAutoTranslationSetting(session.currentCompanyId);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <AutoTranslationForm
      setting={setting}
      companyName={companyName}
      editable={canEdit(session.permissions, 'company_management')}
      aiReady={isAiConfigured()}
    />
  );
}
