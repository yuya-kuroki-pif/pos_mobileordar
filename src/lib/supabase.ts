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
