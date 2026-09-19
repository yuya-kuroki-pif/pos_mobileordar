import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * service_role キーを使う Supabase クライアント。
 *
 * このキーは RLS を迂回するため、**サーバー側でのみ**使うこと。
 * 誤ってクライアントバンドルに混入した場合に気付けるよう、
 * import 時点で window の有無を確認している。
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'supabaseAdmin() はサーバー側専用です。クライアントコンポーネントから呼ばないでください。'
    );
  }

  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase の接続情報が設定されていません。' +
        '.env.example を .env.local にコピーし、NEXT_PUBLIC_SUPABASE_URL と ' +
        'SUPABASE_SERVICE_ROLE_KEY を記入してください。'
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}

/** 環境変数が揃っているか。セットアップ案内を出すかどうかの判定に使う */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * デモモード（DB を使わず、サーバーのメモリ上のデータで全画面を動かす）かどうか。
 *
 * クローンしてすぐ画面を確認したい場合や、Supabase の用意が済んでいない段階で
 * 動きを見たい場合に使う。データはサーバーを再起動すると初期状態に戻る。
 *
 * 本番で意図せず有効になると「保存したのに消える」事故になるため、
 * 明示的な指定があるか、開発中に接続情報が無い場合に限って有効にする。
 */
export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === '1') return true;
  return process.env.NODE_ENV !== 'production' && !isSupabaseConfigured();
}
