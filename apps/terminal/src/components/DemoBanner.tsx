import { isDemoMode } from '@/lib/supabase';

/**
 * デモモードで動いていることを画面上に明示する。
 *
 * 「入力したのに翌日消えている」という誤解を避けるため、
 * データが保存されない旨をはっきり書いておく。
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="no-print bg-amber-400 px-4 py-2 text-center text-[13px] font-semibold text-amber-950">
      デモモードで動作中 — データはサーバーのメモリ上にあり、再起動すると初期状態に戻ります
    </div>
  );
}
