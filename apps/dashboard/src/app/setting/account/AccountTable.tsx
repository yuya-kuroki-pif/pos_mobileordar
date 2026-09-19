'use client';

import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Flex, Input, Select, Space, Table, Tag } from 'antd';
import { useMemo, useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { setAccountStatusAction } from '@/lib/actions/settings';
import { canEdit, type PermissionMap } from '@/lib/permissions';
import type { AccountRow, Company, RoleDefinition, Shop } from '@/lib/types';

import { AccountModal } from './AccountModal';

const STATUS_TAG = {
  active: { color: 'green', label: '有効' },
  invited: { color: 'gold', label: '招待中' },
  disabled: { color: 'default', label: '無効' },
} as const;

export function AccountTable({
  accounts,
  roles,
  companies,
  shops,
  permissions,
}: {
  accounts: AccountRow[];
  roles: RoleDefinition[];
  companies: Company[];
  shops: Shop[];
  permissions: PermissionMap;
}) {
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [editing, setEditing] = useState<AccountRow | 'new' | null>(null);
  const [pending, startTransition] = useTransition();

  const editable = canEdit(permissions, 'account_management');

  const rows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return accounts.filter((account) => {
      if (statusFilter && account.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        account.name.toLowerCase().includes(needle) ||
        account.email.toLowerCase().includes(needle)
      );
    });
  }, [accounts, keyword, statusFilter]);

  function toggleStatus(account: AccountRow) {
    const next = account.status === 'disabled' ? 'active' : 'disabled';
    startTransition(async () => {
      const result = await setAccountStatusAction(account.id, next);
      if (result.ok) message.success(next === 'disabled' ? '無効にしました' : '有効にしました');
      else message.error(result.error ?? '変更できませんでした');
    });
  }

  return (
    <>
      <PageHeader
        title="アカウント"
        description="ダッシュボードにログインできるアカウントと、その権限・適用範囲"
        breadcrumb={[{ label: '設定' }, { label: 'アカウント' }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!editable}
            onClick={() => setEditing('new')}
          >
            新規作成
          </Button>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Flex gap={8} wrap style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Input.Search
            placeholder="氏名・メールアドレスで検索"
            allowClear
            style={{ maxWidth: 280 }}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            placeholder="ステータス"
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'active', label: '有効' },
              { value: 'invited', label: '招待中' },
              { value: 'disabled', label: '無効' },
            ]}
          />
        </Flex>

        <Table<AccountRow>
          rowKey="id"
          dataSource={rows}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            defaultPageSize: 10,
            showTotal: (total) => `全 ${total} 件`,
          }}
          columns={[
            { title: '氏名', dataIndex: 'name', width: 160 },
            { title: 'メールアドレス', dataIndex: 'email' },
            {
              title: 'ロール',
              dataIndex: 'role_name',
              width: 140,
              render: (value: string | null) =>
                value ? <Tag color="blue">{value}</Tag> : <Tag>未割当</Tag>,
            },
            {
              title: '適用範囲',
              key: 'scope',
              width: 240,
              render: (_, row) => {
                if (row.scope_type === 'corporation') return <Tag>全社</Tag>;
                if (row.scope_labels.length === 0) return <span style={{ color: '#bfbfbf' }}>—</span>;
                return (
                  <Space size={4} wrap>
                    {row.scope_labels.slice(0, 3).map((label) => (
                      <Tag key={label}>{label}</Tag>
                    ))}
                    {row.scope_labels.length > 3 && <span>+ {row.scope_labels.length - 3} ...</span>}
                  </Space>
                );
              },
            },
            {
              title: 'ステータス',
              dataIndex: 'status',
              width: 100,
              render: (value: AccountRow['status']) => (
                <Tag color={STATUS_TAG[value].color}>{STATUS_TAG[value].label}</Tag>
              ),
            },
            {
              title: '',
              key: 'actions',
              width: 140,
              align: 'right',
              render: (_, row) => (
                <Space size={0}>
                  <Button type="link" size="small" disabled={!editable} onClick={() => setEditing(row)}>
                    編集
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger={row.status !== 'disabled'}
                    disabled={!editable || pending}
                    onClick={() => toggleStatus(row)}
                  >
                    {row.status === 'disabled' ? '有効化' : '無効化'}
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {editing && (
        <AccountModal
          account={editing === 'new' ? null : editing}
          roles={roles}
          companies={companies}
          shops={shops}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            message.success('保存しました');
          }}
        />
      )}
    </>
  );
}
