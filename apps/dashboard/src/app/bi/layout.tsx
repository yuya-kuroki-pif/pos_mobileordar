import { SectionLayout } from '@/components/SectionLayout';

export const dynamic = 'force-dynamic';

/** 経営管理（BI）セクション。サイドメニューは §4.3 */
export default function BiLayout({ children }: { children: React.ReactNode }) {
  return <SectionLayout section="bi">{children}</SectionLayout>;
}
