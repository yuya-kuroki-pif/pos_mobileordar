import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';

import { AssistantView } from './AssistantView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'メニューアシスタント' };

/**
 * 言葉でメニューマスターを直せる画面。
 * AI は変更の計画を出すだけで、書き込むのは人が「実行」を押したとき。
 */
export default async function MenuAssistantPage() {
  const session = await requireSession();
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <AssistantView
      companyName={companyName}
      editable={canEdit(session.permissions, 'menu_master')}
      configured={Boolean(process.env.ANTHROPIC_API_KEY)}
    />
  );
}
