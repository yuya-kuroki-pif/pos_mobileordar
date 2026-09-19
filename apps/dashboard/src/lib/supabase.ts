import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * service_role キーを使う Supabase クライアント。**サーバー側専用**。
 *
 * 端末アプリと同じ方針で、ブラウザから DB を直接触らせない
 * （全テーブル RLS 有効・anon 向けポリシーなし）。
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin() はサーバー側専用です。');
  }
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase の接続情報が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と ' +
        'SUPABASE_SERVICE_ROLE_KEY を記入してください。'
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * デモモード。接続情報が無い開発環境では、メモリ上のデータで画面を動かす。
 * 本番で誤って有効にならないよう、明示指定か「開発環境かつ未設定」に限る。
 */
export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === '1') return true;
  return process.env.NODE_ENV !== 'production' && !isSupabaseConfigured();
}
