import { requireSession } from '@/lib/auth';
import { getQuestionnaireQuestions, getQuestionnaires } from '@/lib/extrasQueries';
import { canEdit } from '@/lib/permissions';

import { QuestionnaireView } from './QuestionnaireView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'カスタムアンケート' };

/** カスタムアンケート（仕様書 §5.31）。既定の設問に加えて業態ごとの設問を足す */
export default async function CompanyQuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q } = await searchParams;

  const questionnaires = await getQuestionnaires(session.currentCompanyId);
  const current = questionnaires.find((row) => row.id === q) ?? questionnaires[0];
  const questions = current ? await getQuestionnaireQuestions(current.id) : [];

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <QuestionnaireView
      companyName={companyName}
      questionnaires={questionnaires.map((row) => ({ id: row.id, name: row.name, kind: row.kind }))}
      currentId={current?.id}
      questions={questions}
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
      editable={canEdit(session.permissions, 'crm')}
    />
  );
}
