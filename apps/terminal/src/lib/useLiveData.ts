'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 一定間隔でサーバーから最新データを取り直すフック。
 *
 * Supabase Realtime を使わずポーリングにしているのは、ブラウザから DB へ
 * 直接つながせない設計（RLS 全拒否 + サーバー経由）を保つため。
 * 1 店舗あたりの端末は数台なので、5 秒間隔でも負荷は問題にならない。
 *
 * - タブが裏に回っている間は止める（無駄な通信とバッテリー消費を避ける）
 * - タブに戻った瞬間に 1 回取り直す（古い画面のまま操作させない）
 */
export function useLiveData<T>(
  url: string,
  initial: T,
  intervalMs = 5000
): { data: T; refresh: () => void; stale: boolean } {
  const [data, setData] = useState<T>(initial);
  // 通信が失敗している間は「最新ではない」と画面側に伝える
  const [stale, setStale] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    // 前回のリクエストが終わっていなければ重ねて投げない
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as T);
      setStale(false);
    } catch {
      setStale(true);
    } finally {
      inFlight.current = false;
    }
  }, [url]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(refresh, intervalMs);
    };
    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, intervalMs]);

  return { data, refresh, stale };
}

/**
 * 1 秒ごとに再描画させるためのフック。
 * 「12分経過」のような経過時間表示を、データを取り直さずに進めるのに使う。
 */
export function useTicker(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
