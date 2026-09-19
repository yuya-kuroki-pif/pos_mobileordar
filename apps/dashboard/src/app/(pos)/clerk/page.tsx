import { renderMasterPage } from '@/lib/masterPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: '店員' };

/** 店員（仕様書 §5.15〜§5.17。宣言ベースのマスター画面） */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop } = await searchParams;
  return renderMasterPage('clerk', shop);
}
