import { SectionLayout } from '@/components/SectionLayout';

export const dynamic = 'force-dynamic';

/** AI セクション（仕様書 §7.1） */
export default function AiLayout({ children }: { children: React.ReactNode }) {
  return <SectionLayout section="ai">{children}</SectionLayout>;
}
