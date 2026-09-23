import { requireSession } from '@/lib/auth';
import { getGoogleProfiles, getGoogleReviews } from '@/lib/extrasQueries';
import { canEdit } from '@/lib/permissions';

import { ReviewView } from './ReviewView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'クチコミ獲得' };

/** クチコミ獲得・返信（仕様書 §7.2） */
export default async function AttractReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const session = await requireSession();
  const { shop } = await searchParams;

  const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);
  const target = shops.find((s) => s.id === shop) ?? shops[0];
  const scope = target ? [target.id] : [];

  const [profiles, reviews] = await Promise.all([
    getGoogleProfiles(scope),
    getGoogleReviews(scope),
  ]);

  const companyName =
    session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';

  return (
    <ReviewView
      companyName={companyName}
      shops={shops.map((s) => ({ id: s.id, name: s.name }))}
      shopId={target?.id}
      connected={profiles[0]?.is_connected ?? false}
      syncedAt={profiles[0]?.synced_at ?? null}
      reviews={reviews}
      editable={canEdit(session.permissions, 'attract_all')}
    />
  );
}
