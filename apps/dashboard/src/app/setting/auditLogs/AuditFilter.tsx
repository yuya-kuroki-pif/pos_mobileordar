'use client';

import { Select, Space } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';

/** 操作履歴の絞り込み。URL のクエリを差し替えるだけ */
export function AuditFilter({
  actions,
  accounts,
  action,
  account,
}: {
  actions: { value: string; label: string }[];
  accounts: { value: string; label: string }[];
  action?: string;
  account?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.push(`/setting/auditLogs?${next.toString()}`);
  };

  return (
    <Space>
      <Select
        value={account ?? 'all'}
        style={{ width: 200 }}
        onChange={(value) => go('account', value)}
        options={[{ value: 'all', label: 'すべての実行者' }, ...accounts]}
      />
      <Select
        value={action ?? 'all'}
        style={{ width: 200 }}
        onChange={(value) => go('action', value)}
        options={[{ value: 'all', label: 'すべての操作' }, ...actions]}
      />
    </Space>
  );
}
