import { renderMasterPage } from '@/lib/masterPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: '収支登録' };

/** 収支登録（仕様書 §6.8。宣言ベースのマスター画面） */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop } = await searchParams;
  return renderMasterPage('incomeExpense', shop);
}
