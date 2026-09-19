import { SectionLayout } from '@/components/SectionLayout';

export const dynamic = 'force-dynamic';

/** 集客セクション（仕様書 §7.2） */
export default function AttractLayout({ children }: { children: React.ReactNode }) {
  return <SectionLayout section="attract">{children}</SectionLayout>;
}
