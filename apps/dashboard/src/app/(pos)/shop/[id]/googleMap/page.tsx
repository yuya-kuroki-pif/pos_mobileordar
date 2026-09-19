import { notFound } from 'next/navigation';

import { requireSession } from '@/lib/auth';
import { canEdit } from '@/lib/permissions';
import { getShopDetail } from '@/lib/shopQueries';

import { ShopEditFrame } from '../ShopEditFrame';
import { GoogleMapForm } from './GoogleMapForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Google マップ設定' };

/** 店舗編集 — Google マップ設定タブ（仕様書 §5.12） */
export default async function ShopGoogleMapFormPage({
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
      tab="googleMap"
    >
      <GoogleMapForm
        shop={detail.shop}
        editable={canEdit(session.permissions, 'shop_management')}
      />
    </ShopEditFrame>
  );
}
