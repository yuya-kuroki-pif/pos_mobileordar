'use client';

import { Tabs } from 'antd';

import { PageHeader } from '@/components/PageHeader';
import { canEdit, type PermissionMap } from '@/lib/permissions';
import type { PaymentSettings } from '@/lib/types';

import { NameListTable } from './NameListTable';
import { PaymentMethodTable } from './PaymentMethodTable';
import { TerminalMappingTable } from './TerminalMappingTable';

/**
 * 支払方法等設定（仕様書 §5.10）。
 * 指示書では 4 つの URL に分かれているが、ナビゲーション上は 1 項目なので
 * 1 画面のタブにまとめている。いずれも業態単位のマスター。
 */
export function PaymentSettingsView({
  settings,
  companyName,
  permissions,
}: {
  settings: PaymentSettings;
  companyName: string;
  permissions: PermissionMap;
}) {
  const editable = canEdit(permissions, 'payment_settings');

  return (
    <>
      <PageHeader
        title="支払方法等設定"
        description="レジで選べる支払方法・割引方法・媒体と、決済端末の対応づけ"
        breadcrumb={[{ label: companyName }, { label: '業態管理' }, { label: '支払方法等設定' }]}
      />

      <Tabs
        items={[
          {
            key: 'method',
            label: '支払方法',
            children: <PaymentMethodTable methods={settings.methods} editable={editable} />,
          },
          {
            key: 'discount',
            label: '割引方法',
            children: (
              <NameListTable
                kind="discount"
                label="割引方法"
                description="会計時に選べる値引きの種類。例: 端数値引、スタッフ割引15％、値引き券"
                rows={settings.discountTypes}
                editable={editable}
              />
            ),
          },
          {
            key: 'inflow',
            label: '媒体',
            children: (
              <NameListTable
                kind="inflow"
                label="媒体"
                description="会計時に選ぶ流入媒体。分析で媒体別の売上を見るときに使います"
                rows={settings.inflowSources}
                editable={editable}
              />
            ),
          },
          {
            key: 'terminal',
            label: 'キャッシュレス端末支払方法',
            children: (
              <TerminalMappingTable
                rows={settings.terminals}
                methods={settings.methods}
                editable={editable}
              />
            ),
          },
        ]}
      />
    </>
  );
}
