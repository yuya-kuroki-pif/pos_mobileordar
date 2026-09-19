import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';
import { getShopDetail } from '@/lib/shopQueries';

import { ShopEditFrame } from '../ShopEditFrame';
import { BusinessHourEditor } from './BusinessHourEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '営業時間帯' };

/** 店舗編集 — 営業時間帯タブ（仕様書 §5.12） */
export default async function ShopBusinessHourEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const detail = await getShopDetail(id);
  if (!detail) notFound();

  const companyName =
    session.companies.find((c) => c.id === detail.shop.company_id)?.name ?? '業態';

  return (
    <ShopEditFrame
      shopId={id}
      shopName={detail.shop.name}
      companyName={companyName}
      tab="businessHours"
    >
      <BusinessHourEditor
        shop={detail.shop}
        hours={detail.businessHours}
        editable={canEdit(session.permissions, 'shop_management')}
      />
    </ShopEditFrame>
  );
}
