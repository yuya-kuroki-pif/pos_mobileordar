'use client';

/**
 * ブラウザの印刷ダイアログを開くだけのボタン。
 * レシートプリンタ（ESC/POS）への直接出力は将来の課題として、
 * まずは「印刷」で紙に出せる状態にしてある。
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex-1 rounded-xl border border-charcoal-300 bg-white py-3 font-bold text-charcoal-700"
    >
      印刷
    </button>
  );
}
