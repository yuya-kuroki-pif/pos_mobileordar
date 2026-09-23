import dayjs from 'dayjs';

import { PageHeader } from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getQuestionnaireAnswers } from '@/lib/crmQueries';
import { GENDER_LABELS } from '@/lib/types';

import { CommentCards, type CommentCard } from './CommentCards';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'コメント一覧' };

/** コメント一覧（仕様書 §5.32） */
export default async function CommentPage() {
  const session = await requireSession();

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const answers = await getQuestionnaireAnswers(shops.map((s) => s.id));
  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  const comments: CommentCard[] = answers
    .filter((a) => a.comment)
    .sort((a, b) => (a.answered_at < b.answered_at ? 1 : -1))
    .slice(0, 60)
    .map((answer) => ({
      id: answer.id,
      comment: answer.comment ?? '',
      shop_name: shopName.get(answer.shop_id) ?? answer.shop_id,
      gender_label: GENDER_LABELS[answer.gender],
      age: answer.age,
      answered_on: dayjs(answer.answered_at).format('YYYY/MM/DD'),
    }));

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <>
      <PageHeader
        title="コメント一覧"
        description="アンケートに書かれた自由記述"
        breadcrumb={[{ label: companyName }, { label: 'アンケート分析' }, { label: 'コメント一覧' }]}
      />

      <CommentCards comments={comments} />
    </>
  );
}
