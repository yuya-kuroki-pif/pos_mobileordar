import { requireSession } from '@/lib/auth';
import { currentUiLocale } from '@/lib/localeServer';
import type { TopSection } from '@/lib/menuTree';

import { AppShell } from './AppShell';

/**
 * 各セクション（POS / 経営管理 / 設定 …）の共通ラッパ。
 * ログイン確認とレイアウトの組み立てをここに集約する。
 */
export async function SectionLayout({
  section,
  children,
}: {
  section: TopSection;
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const uiLocale = await currentUiLocale();

  return (
    <AppShell
      section={section}
      companies={session.companies}
      currentCompanyId={session.currentCompanyId}
      accountName={session.account.name}
      roleName={session.roleName}
      permissions={session.permissions}
      uiLocale={uiLocale}
    >
      {children}
    </AppShell>
  );
}
