'use client';

import { Tabs } from 'antd';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';

export type ShopEditTab = 'edit' | 'businessHours' | 'register' | 'googleMap';

const TABS: { key: ShopEditTab; label: string }[] = [
  { key: 'edit', label: '店舗' },
  { key: 'businessHours', label: '営業時間帯' },
  { key: 'register', label: 'レジ設定' },
  { key: 'googleMap', label: 'Google マップ設定' },
];

/** 店舗編集画面の枠（仕様書 §5.12）。タブは URL と同期させる */
export function ShopEditFrame({
  shopId,
  shopName,
  companyName,
  tab,
  children,
}: {
  shopId: string;
  shopName: string;
  companyName: string;
  tab: ShopEditTab;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title={shopName}
        backTo="/shop"
        breadcrumb={[
          { label: companyName },
          { label: '店舗管理' },
          { label: '店舗', href: '/shop' },
          { label: shopName },
        ]}
      />

      <Tabs
        activeKey={tab}
        onChange={(key) => router.push(`/shop/${shopId}/${key}`)}
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
      />

      <div style={{ maxWidth: 900 }}>{children}</div>
    </>
  );
}
