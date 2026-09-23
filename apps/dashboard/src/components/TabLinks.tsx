'use client';

import { Tabs } from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * クエリでタブを切り替える。
 * 中身はサーバーで作りたいので、タブだけをクライアントに置いている。
 */
export function TabLinks({
  items,
  active,
  param = 'tab',
}: {
  items: { key: string; label: string }[];
  active: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Tabs
      activeKey={active}
      items={items}
      onChange={(key) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set(param, key);
        router.push(`${pathname}?${next.toString()}`);
      }}
    />
  );
}
