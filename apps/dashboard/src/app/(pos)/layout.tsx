import { SectionLayout } from '@/components/SectionLayout';

export const dynamic = 'force-dynamic';

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <SectionLayout section="pos">{children}</SectionLayout>;
}
