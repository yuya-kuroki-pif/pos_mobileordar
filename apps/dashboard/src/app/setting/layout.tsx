import { SectionLayout } from '@/components/SectionLayout';

export const dynamic = 'force-dynamic';

export default function SettingLayout({ children }: { children: React.ReactNode }) {
  return <SectionLayout section="setting">{children}</SectionLayout>;
}
