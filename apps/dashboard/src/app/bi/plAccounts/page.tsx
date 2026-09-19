import { renderMasterPage } from '@/lib/masterPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: '科目登録' };

/** 科目登録（仕様書 §6.9。宣言ベースのマスター画面） */
export default async function Page() {
  return renderMasterPage('plAccount');
}
