import { Card } from './ui';

/**
 * Supabase の接続情報が未設定のときに出す案内。
 * 初回セットアップで「動かない理由」がすぐ分かるようにするためのもの。
 */
export function SetupNotice() {
  return (
    <Card className="mx-auto max-w-2xl p-8">
      <h2 className="text-xl font-bold text-charcoal-900">セットアップが未完了です</h2>
      <p className="mt-2 text-sm text-charcoal-600">
        Supabase の接続情報が設定されていないため、データを読み込めませんでした。
        以下の手順を実行してから再読み込みしてください。
      </p>

      <ol className="mt-5 space-y-4 text-sm text-charcoal-700">
        <li>
          <p className="font-semibold">1. Supabase プロジェクトを用意する</p>
          <p className="mt-1 text-charcoal-500">
            <a
              className="text-ember-600 underline"
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              supabase.com/dashboard
            </a>
            で新規プロジェクトを作成します。
          </p>
        </li>
        <li>
          <p className="font-semibold">2. スキーマを適用する</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-charcoal-800 p-3 text-xs text-charcoal-100">
            {`supabase link --project-ref <ref>\nsupabase db push\npsql "$DATABASE_URL" -f supabase/seed.sql`}
          </pre>
          <p className="mt-1 text-charcoal-500">
            CLI を使わない場合は、SQL Editor に <code>supabase/migrations/</code> の
            ファイルを番号順に貼り付けて実行しても構いません。
          </p>
        </li>
        <li>
          <p className="font-semibold">3. 環境変数を設定する</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-charcoal-800 p-3 text-xs text-charcoal-100">
            {`cp .env.example .env.local\n# NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SESSION_SECRET を記入`}
          </pre>
        </li>
        <li>
          <p className="font-semibold">4. 開発サーバーを再起動する</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-charcoal-800 p-3 text-xs text-charcoal-100">
            npm run dev
          </pre>
        </li>
      </ol>

      <p className="mt-6 rounded-xl bg-charcoal-50 p-3 text-xs text-charcoal-500">
        詳しい手順は README.md の「セットアップ」を参照してください。
      </p>
    </Card>
  );
}
