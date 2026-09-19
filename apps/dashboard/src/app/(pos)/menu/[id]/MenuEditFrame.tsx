'use client';

import { Tabs } from 'antd';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/PageHeader';

export type MenuEditTab = 'edit' | 'option' | 'dealer' | 'translation';

const TABS: { key: MenuEditTab; label: string }[] = [
  { key: 'edit', label: '基本情報' },
  { key: 'option', label: 'オプション' },
  { key: 'dealer', label: '取扱設定' },
  { key: 'translation', label: '多言語設定' },
];

/**
 * メニュー編集画面の枠（仕様書 §5.3）。
 * タブは URL と同期させる（§11 の EntityTabs）。新規作成時は基本情報だけ。
 */
export function MenuEditFrame({
  menuId,
  title,
  companyName,
  dealingShopNames,
  tab,
  children,
}: {
  menuId: string;
  title: string;
  companyName: string;
  /** タイトル横に出す「取扱店舗」タグ */
  dealingShopNames: string[];
  tab: MenuEditTab;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isNew = menuId === 'new';

  return (
    <>
      <PageHeader
        title={title}
        backTo="/menu"
        breadcrumb={[
          { label: companyName },
          { label: 'メニューマスター', href: '/menu' },
          { label: isNew ? '新規作成' : title },
        ]}
        tags={dealingShopNames}
      />

      <Tabs
        activeKey={tab}
        onChange={(key) => router.push(`/menu/${menuId}/${key}`)}
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          // 保存していないメニューには紐付け先が無いので、基本情報だけ触れるようにする
          disabled: isNew && t.key !== 'edit',
        }))}
      />

      <div style={{ maxWidth: 900 }}>{children}</div>
    </>
  );
}
