'use client';

import { Tabs } from 'antd';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';

export type PlanEditTab =
  | 'edit'
  | 'option'
  | 'category'
  | 'menu'
  | 'firstOrder'
  | 'dealer';

const TABS: { key: PlanEditTab; label: string }[] = [
  { key: 'edit', label: '基本情報' },
  { key: 'option', label: 'オプション' },
  { key: 'category', label: 'プラン内カテゴリ' },
  { key: 'menu', label: 'プラン内メニュー' },
  { key: 'firstOrder', label: '自動注文設定' },
  { key: 'dealer', label: '取扱設定' },
];

/** プラン編集画面の枠（仕様書 §5.4）。タブは URL と同期させる */
export function PlanEditFrame({
  planId,
  title,
  companyName,
  dealingShopNames,
  tab,
  children,
}: {
  planId: string;
  title: string;
  companyName: string;
  dealingShopNames: string[];
  tab: PlanEditTab;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isNew = planId === 'new';

  return (
    <>
      <PageHeader
        title={title}
        backTo="/plan"
        breadcrumb={[
          { label: companyName },
          { label: 'メニューマスター' },
          { label: 'プラン', href: '/plan' },
          { label: isNew ? '新規作成' : title },
        ]}
        tags={dealingShopNames}
      />

      <Tabs
        activeKey={tab}
        onChange={(key) => router.push(`/plan/${planId}/${key}`)}
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          // 保存していないプランには紐付け先が無いので、基本情報だけ触れるようにする
          disabled: isNew && t.key !== 'edit',
        }))}
      />

      <div style={{ maxWidth: 900 }}>{children}</div>
    </>
  );
}
