'use client';

import { App, Alert, Button, Card, Empty, Select, Space, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setPlanCategoryMenusAction } from '@/lib/actions/plan';
import type { MenuRow, PlanCategory, PlanMenuLink } from '@/lib/types';

/**
 * プラン内メニュータブ（仕様書 §5.4）。
 * プラン内カテゴリごとに、プラン注文中 0 円で頼めるメニューを選ぶ。
 */
export function PlanMenuEditor({
  planId,
  categories,
  links,
  menus,
  editable,
}: {
  planId: string;
  categories: PlanCategory[];
  links: PlanMenuLink[];
  menus: MenuRow[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [selection, setSelection] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      categories.map((category) => [
        category.id,
        links.filter((l) => l.plan_category_id === category.id).map((l) => l.menu_id),
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const menuOptions = menus.map((menu) => ({
    value: menu.id,
    label: `${menu.name}（¥${menu.price.toLocaleString()}）`,
  }));

  function save(categoryId: string) {
    setSavingId(categoryId);
    startTransition(async () => {
      const result = await setPlanCategoryMenusAction(
        planId,
        categoryId,
        selection[categoryId] ?? []
      );
      setSavingId(null);
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      router.refresh();
    });
  }

  if (categories.length === 0) {
    return (
      <Card style={{ marginTop: 16 }}>
        <Empty description="プラン内カテゴリがまだありません">
          <Link href={`/plan/${planId}/category`}>
            <Button type="primary">プラン内カテゴリを作る</Button>
          </Link>
        </Empty>
      </Card>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="プラン内メニューは 0 円で提供されます"
        description="ここで選んだメニューは、プランの制限時間内なら何度でも 0 円で注文できます。"
      />

      {categories.map((category) => (
        <Card
          key={category.id}
          size="small"
          title={category.name}
          style={{ marginBottom: 16 }}
          extra={
            <Button
              type="primary"
              size="small"
              loading={savingId === category.id}
              disabled={!editable}
              onClick={() => save(category.id)}
            >
              保存
            </Button>
          }
        >
          <Select
            mode="multiple"
            allowClear
            disabled={!editable}
            style={{ width: '100%' }}
            placeholder="メニューを選択"
            value={selection[category.id] ?? []}
            options={menuOptions}
            optionFilterProp="label"
            onChange={(value) => setSelection((c) => ({ ...c, [category.id]: value }))}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {(selection[category.id] ?? []).length} 品
          </Typography.Text>
        </Card>
      ))}

      <Space>
        <Button onClick={() => router.push('/plan')}>プラン一覧へ戻る</Button>
      </Space>
    </div>
  );
}
