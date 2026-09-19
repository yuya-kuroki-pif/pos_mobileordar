'use client';

import { App, Button, Card, Select, Space, Table, Tag, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { saveRolePermissionsAction } from '@/lib/actions/settings';
import {
  FEATURE_GROUPS,
  FEATURE_LABEL,
  LEVEL_LABEL,
  canEdit,
  levelOf,
  type FeatureKey,
  type PermissionLevel,
  type PermissionMap,
} from '@/lib/permissions';
import type { RoleDefinition } from '@/lib/types';

const LEVEL_OPTIONS = (['edit', 'view', 'none'] as const).map((level) => ({
  value: level,
  label: LEVEL_LABEL[level],
}));

interface Row {
  key: string;
  group: string;
  feature?: FeatureKey;
}

/**
 * ロール × 機能キー × 権限レベルの表（仕様書 §10.2）。
 * 機能を分類ごとにまとめ、行ヘッダーにグループ名を挟む。
 */
export function RoleMatrix({
  roles,
  permissions,
}: {
  roles: RoleDefinition[];
  permissions: PermissionMap;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 編集中の値をロールごとに保持し、「保存」でまとめて送る
  const [draft, setDraft] = useState<Record<string, PermissionMap>>(() =>
    Object.fromEntries(roles.map((role) => [role.id, { ...role.permissions }]))
  );

  const editable = canEdit(permissions, 'account_management');

  const dirty = roles.some((role) =>
    FEATURE_GROUPS.flatMap((g) => g.keys).some(
      (key) => levelOf(draft[role.id] ?? {}, key) !== levelOf(role.permissions, key)
    )
  );

  const rows: Row[] = FEATURE_GROUPS.flatMap((group) => [
    { key: `group-${group.label}`, group: group.label },
    ...group.keys.map((feature) => ({ key: feature, group: group.label, feature })),
  ]);

  function change(roleId: string, feature: FeatureKey, level: PermissionLevel) {
    setDraft((current) => ({
      ...current,
      [roleId]: { ...(current[roleId] ?? {}), [feature]: level },
    }));
  }

  function save() {
    startTransition(async () => {
      for (const role of roles) {
        const next = draft[role.id];
        if (!next) continue;
        const result = await saveRolePermissionsAction(role.id, next);
        if (!result.ok) {
          message.error(result.error ?? '保存できませんでした');
          return;
        }
      }
      message.success('権限を保存しました');
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="権限設定"
        description="ロールごとに、機能の「編集可能 / 閲覧可能 / 閲覧不可」を決めます"
        breadcrumb={[{ label: '設定' }, { label: '権限設定' }]}
        extra={
          <Space>
            <Button
              onClick={() =>
                setDraft(Object.fromEntries(roles.map((r) => [r.id, { ...r.permissions }])))
              }
              disabled={!dirty || pending}
            >
              変更を破棄
            </Button>
            <Button type="primary" onClick={save} disabled={!editable || !dirty} loading={pending}>
              保 存
            </Button>
          </Space>
        }
      />

      {!editable && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          閲覧のみの権限のため、変更はできません。
        </Typography.Paragraph>
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Row>
          rowKey="key"
          dataSource={rows}
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: '機能',
              key: 'feature',
              width: 260,
              fixed: 'left',
              render: (_, row) =>
                row.feature ? (
                  FEATURE_LABEL[row.feature]
                ) : (
                  <Typography.Text strong style={{ fontSize: 13 }}>
                    {row.group}
                  </Typography.Text>
                ),
              onCell: (row) =>
                row.feature ? {} : { colSpan: 1, style: { background: '#fafafa' } },
            },
            ...roles.map((role) => ({
              title: (
                <Space size={4}>
                  {role.name}
                  {role.is_system && <Tag color="blue">既定</Tag>}
                </Space>
              ),
              key: role.id,
              width: 180,
              render: (_: unknown, row: Row) => {
                if (!row.feature) return <div style={{ background: '#fafafa', height: 1 }} />;
                return (
                  <Select<PermissionLevel>
                    size="small"
                    style={{ width: 130 }}
                    disabled={!editable}
                    value={levelOf(draft[role.id] ?? {}, row.feature)}
                    options={LEVEL_OPTIONS}
                    onChange={(level) => change(role.id, row.feature!, level)}
                  />
                );
              },
              onCell: (row: Row) => (row.feature ? {} : { style: { background: '#fafafa' } }),
            })),
          ]}
        />
      </Card>
    </>
  );
}
