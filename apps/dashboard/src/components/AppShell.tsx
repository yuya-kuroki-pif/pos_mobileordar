'use client';

import {
  BellOutlined,
  DownOutlined,
  GlobalOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Dropdown, Layout, Menu, Tooltip, Typography } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { setUiLocaleAction } from '@/lib/actions/locale';
import { logoutAction, switchCompanyAction } from '@/lib/actions/session';
import { MENU_BY_SECTION, TOP_TABS, type TopSection } from '@/lib/menuTree';
import { canView, type PermissionMap } from '@/lib/permissions';
import type { Company } from '@/lib/types';
import { makeTranslator, UI_LOCALES, type UiLocale } from '@/lib/uiLocale';
import { HEADER_BG, HEADER_TAB_ACTIVE_BG } from '@/styles/theme';

import { LocaleProvider } from './LocaleProvider';

const { Header, Sider, Content } = Layout;

/** サイドバー下部に出す環境バージョン。仕様書 §3.1 に倣う */
const APP_VERSION = '0.1.0';

export function AppShell({
  section,
  companies,
  currentCompanyId,
  accountName,
  roleName,
  permissions,
  uiLocale,
  children,
}: {
  section: TopSection;
  companies: Company[];
  currentCompanyId: string;
  accountName: string;
  roleName: string | null;
  permissions: PermissionMap;
  uiLocale: UiLocale;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [, startTransition] = useTransition();

  // 訳が用意されていない文字列は日本語のまま出す
  const t = useMemo(() => makeTranslator(uiLocale), [uiLocale]);

  const currentCompany = companies.find((c) => c.id === currentCompanyId);

  // 権限が「閲覧不可」の項目は出さない。空になったグループも畳む
  const menuItems = useMemo(() => {
    return MENU_BY_SECTION[section]
      .map((group) => ({
        key: group.key,
        label: t(group.label),
        type: 'group' as const,
        children: group.children
          .filter((leaf) => !leaf.feature || canView(permissions, leaf.feature))
          .map((leaf) => ({
            key: leaf.href,
            label: leaf.pending ? (
              <Tooltip title="この画面は未実装です（対応フェーズで追加）" placement="right">
                <span style={{ opacity: 0.45 }}>{t(leaf.label)}</span>
              </Tooltip>
            ) : (
              <Link href={leaf.href}>{t(leaf.label)}</Link>
            ),
            disabled: leaf.pending,
          })),
      }))
      .filter((group) => group.children.length > 0);
  }, [section, permissions, t]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: HEADER_BG,
        }}
      >
        <Link href="/" style={{ color: '#fff', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
          Dashboard
        </Link>

        {/* 業態セレクタ。切り替えると POS セクション全体のコンテキストが変わる */}
        <Dropdown
          menu={{
            items: companies.map((company) => ({ key: company.id, label: company.name })),
            selectable: true,
            selectedKeys: currentCompanyId ? [currentCompanyId] : [],
            onClick: ({ key }) =>
              startTransition(async () => {
                await switchCompanyAction(key);
                router.refresh();
              }),
          }}
        >
          <Button type="text" style={{ color: '#fff' }}>
            {currentCompany?.name ?? '業態を選択'} <DownOutlined />
          </Button>
        </Dropdown>

        <nav style={{ display: 'flex', gap: 4 }}>
          {TOP_TABS.map((tab) => {
            const active = tab.key === section;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                style={{
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  background: active ? HEADER_TAB_ACTIVE_BG : 'transparent',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                }}
              >
                {t(tab.label)}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tooltip title="ヘルプ">
            <Button type="text" style={{ color: 'rgba(255,255,255,0.65)' }} icon={<QuestionCircleOutlined />} />
          </Tooltip>

          <Dropdown
            menu={{
              selectedKeys: [uiLocale],
              items: UI_LOCALES.map((item) => ({ key: item.value, label: item.label })),
              onClick: ({ key }) => startTransition(() => void setUiLocaleAction(key)),
            }}
          >
            <Button type="text" style={{ color: 'rgba(255,255,255,0.65)' }}>
              <GlobalOutlined style={{ marginRight: 6 }} />
              {UI_LOCALES.find((item) => item.value === uiLocale)?.label}
            </Button>
          </Dropdown>

          <Dropdown
            menu={{
              items: [
                { key: 'role', label: `ロール: ${roleName ?? '未割当'}`, disabled: true },
                { type: 'divider' },
                { key: 'logout', label: t('ログアウト'), danger: true },
              ],
              onClick: ({ key }) => {
                if (key === 'logout') startTransition(() => void logoutAction());
              },
            }}
          >
            <Button type="text" style={{ color: '#fff' }}>
              <Avatar size={24} icon={<UserOutlined />} style={{ marginRight: 8 }} />
              {accountName}
            </Button>
          </Dropdown>

          <Badge dot>
            <Button type="text" style={{ color: 'rgba(255,255,255,0.65)' }} icon={<BellOutlined />} />
          </Badge>
        </div>
      </Header>

      <Layout>
        <Sider
          width={240}
          theme="light"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{ borderRight: '1px solid #f0f0f0' }}
        >
          <Menu
            mode="inline"
            items={menuItems}
            selectedKeys={[pathname]}
            style={{ borderInlineEnd: 'none', paddingTop: 8 }}
          />
          {!collapsed && (
            <Typography.Text
              type="secondary"
              style={{ display: 'block', padding: '8px 16px', fontSize: 11 }}
            >
              v{APP_VERSION}
            </Typography.Text>
          )}
        </Sider>

        <Content className="app-content" style={{ padding: 24 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <LocaleProvider locale={uiLocale}>{children}</LocaleProvider>
          </div>
        </Content>
      </Layout>

      {/* 左下フローティングのチャットボタン（仕様書 §3.1） */}
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<MessageOutlined />}
        style={{ position: 'fixed', left: 20, bottom: 20, zIndex: 30 }}
        aria-label="サポートチャット"
      />
    </Layout>
  );
}
