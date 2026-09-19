# POS レジ + モバイルオーダー

飲食店向けの POS レジとモバイルオーダーを 1 つにまとめたシステムです。
卓の QR から客が自分で注文し、厨房のディスプレイに流れ、レジで会計する
— その一連の流れをこのリポジトリだけで扱います。

## 画面

| 画面 | URL | 使う人 | できること |
| --- | --- | --- | --- |
| モバイルオーダー | `/order/{qr_token}` | 客（スマホ） | 人数入力 → メニュー閲覧 → オプション選択 → 注文 → 注文状況の確認 → お会計依頼 |
| POS レジ | `/pos` | ホールスタッフ（タブレット） | フロアマップ、卓を開ける（店内/持ち帰り）、注文入力、伝票確認、分割会計、卓移動・伝票結合、レシート印刷、会計取消 |
| レジ締め | `/pos/close` | 店長・締め担当 | 現金の入出金記録、金種を数えて理論在高との過不足を確認 |
| キッチンディスプレイ | `/kds` | 厨房 | 伝票単位のカード表示、調理開始 / でき上がり / 提供済みの操作、遅延の色分け |
| 管理ダッシュボード | `/admin` | 店長・本部 | 売上サマリ、メニュー管理、卓・QR 管理、売上分析、店舗設定 |

スタッフ向け画面（`/pos` `/kds` `/admin`）は店舗コード + PIN でログインします。
モバイルオーダーはログイン不要で、卓ごとの推測不能な QR トークンが入店の根拠になります。

## 技術構成

- **Next.js 16**（App Router / Server Actions）+ TypeScript
- **Tailwind CSS 4**
- **Supabase**（PostgreSQL）

### 設計上の方針

**ブラウザから Supabase を直接触らせない。**
全テーブルで RLS を有効にしたうえで anon / authenticated 向けのポリシーを一切作らず、
アクセスは Next.js のサーバー側（Server Action / Route Handler）から service_role キーで行います。
「この QR トークンを持つ人はこの卓だけ操作できる」といった判定をアプリ側の 1 箇所に集約でき、
ポリシーの書き漏れによる漏洩を避けられます。

**金額と伝票番号は DB 側で確定する。**
価格はクライアントから送らせず、注文時に `menu_items` から引き直します
（`place_order()` / `checkout_payment()`）。伝票番号の採番は advisory lock で直列化しています。

**消費税は税率ごとに分けて計算する。**
店内飲食は標準税率、持ち帰りの飲食料品は軽減税率 8%（酒類は持ち帰りでも 10%）。
サービス料は標準税率のグループに加え、割引は各税率グループへ金額按分します
（端数は最後のグループが負担）。合計から一括で逆算するとインボイスの
記載要件（税率ごとの合計額と消費税額）を満たせないためです。

**注文時点の商品名・価格をスナップショットする。**
`order_items` は `name_snapshot` / `unit_price` / `options_snapshot` を持つため、
後からメニューを変更・削除しても過去の伝票は壊れません。

**画面の更新はポーリング。**
Supabase Realtime を使うとブラウザから DB への直接接続が必要になり、上の方針と衝突します。
1 店舗あたりの端末は数台なので、4〜10 秒間隔のポーリングで十分と判断しました
（`src/lib/useLiveData.ts`。タブが裏に回っている間は停止します）。

## すぐ動かす（デモモード）

データベースを用意せずに全画面を触れます。クローン直後の確認や、画面を人に見せたいときに。

```bash
npm install
npm run dev
```

<http://localhost:3000> を開き、**店舗コード `demo` / PIN `1234`** でログインしてください。
卓・メニュー・進行中の注文・会計済みの売上まで、一通りのデータが最初から入っています。

デモモードは `SUPABASE_SERVICE_ROLE_KEY` が未設定の開発環境で自動的に有効になります
（明示するなら `NEXT_PUBLIC_DEMO_MODE=1`）。データはサーバーのメモリ上にあり、
**再起動すると初期状態に戻ります**。動作中は画面上部に黄色い帯で表示されます。

実装は `src/lib/demo/` にまとまっていて、`queries.ts` と `actions/` が
冒頭で `isDemoMode()` を見て委譲します。金額計算・伝票番号の採番・会計処理は
`supabase/migrations/` の SQL 関数と同じ手順を踏むようにしてあります。

## セットアップ（実データ）

### 1. Supabase プロジェクトを作る

[supabase.com/dashboard](https://supabase.com/dashboard) で新規プロジェクトを作成します。
リージョンは `Northeast Asia (Tokyo)` を選んでください。

### 2. スキーマとデモデータを流す

Supabase CLI を使う場合:

```bash
supabase link --project-ref <プロジェクトの ref>
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

CLI を使わない場合は、ダッシュボードの **SQL Editor** に以下を番号順に貼り付けて実行します。

1. `supabase/migrations/20260919000100_init_schema.sql`
2. `supabase/migrations/20260919000200_functions.sql`
3. `supabase/migrations/20260919000300_rls.sql`
4. `supabase/migrations/20260919000400_phase_a_schema.sql`
5. `supabase/migrations/20260919000500_phase_a_functions.sql`
6. `supabase/seed.sql`（デモ店舗・メニュー・卓のサンプル）

### 3. 環境変数を設定する

```bash
cp .env.example .env.local
```

`.env.local` に以下を記入します。値は Supabase の **Project Settings → API** にあります。

| 変数 | 内容 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開可能キー |
| `SUPABASE_SERVICE_ROLE_KEY` | サービスロールキー（**絶対に公開しない**） |
| `SESSION_SECRET` | スタッフ用 Cookie の署名鍵 |
| `NEXT_PUBLIC_APP_URL` | QR に埋め込む URL。開発中は `http://localhost:3000` |

`SESSION_SECRET` は次のコマンドで生成できます。

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. 起動する

```bash
npm install
npm run dev
```

<http://localhost:3000> を開くと各画面への入口が表示されます。
`seed.sql` を流した場合の初期ログインは **店舗コード `demo` / PIN `1234`** です。
本番で使う前に、管理画面の「店舗設定」から PIN を変更してください。

## 動作確認の流れ

1. `/login` に `demo` / `1234` でログイン
2. `/admin/tables` の「QR 印刷」タブで卓の QR を表示（または URL をコピー）
3. その URL をスマホで開く（`NEXT_PUBLIC_APP_URL` を PC の LAN IP にしておくと実機で試せます）
4. 人数を選んで注文 → `/kds` に注文が流れてくる
5. `/pos` で卓をタップ → 伝票確認 → お会計 → レシート
6. `/admin` に売上が反映される

## データモデル

```
stores ──┬─ restaurant_tables ── table_sessions ──┬─ orders ── order_items
         │                                        └─ payments ←┘（会計済みの明細）
         ├─ categories ── menu_items ──┐
         ├─ option_groups ── options ──┴─ menu_item_option_groups
         └─ cash_movements / cash_drawer_closings
```

- **`table_sessions`** が会計の単位です。「卓を開ける」から「会計する」までが 1 レコードで、
  同じ卓に同時に開けるセッションは 1 つだけになるよう部分ユニークインデックスで保証しています。
- **`orders`** は「注文するを 1 回押した」単位（＝ 1 伝票）。KDS はこの単位でカードを出します。
- **`order_items`** が調理ステータスを持つ最小単位です。`payment_id` が null なら未会計で、
  分割会計はこの列で「どの明細をどの会計で払ったか」を表します。
- **`payments`** は 1 セッションに複数ぶら下がります（分割会計）。
  取り消した会計は削除せず `status = 'refunded'` として残し、売上集計から外します。

営業日は `stores.business_day_cutoff_hour`（既定 5 時）で区切るため、
深夜 2 時の売上は前日として集計されます。

## 今後の拡張余地

現状は意図的に入れていない、実運用で必要になる機能です。

- **決済連携** — 現在の会計は記録のみです。カード・QR 決済は決済端末で処理し、
  その支払方法をシステムに残す運用を想定しています（Stripe 等との接続は未実装）。
- **会計後の一部返品** — 会計全体の取消には対応していますが、
  1 品だけ返すといった部分返品は未対応です。
- **レシートプリンタ** — ブラウザの印刷までは対応。ESC/POS への直接出力は未対応です。
- **複数店舗・スタッフ個人アカウント** — スキーマは `store_id` で分離済みですが、
  ログインは店舗単位の PIN です。個人別の操作履歴が必要なら Supabase Auth の導入が要ります。
- **予約・顧客管理（CRM）** — テーブル設計には含めていません。
- **在庫・原価管理** — 売上側のみの実装です。

## ディレクトリ

```
src/
├─ app/
│  ├─ page.tsx              各画面への入口
│  ├─ login/                スタッフログイン（テンキー UI）
│  ├─ order/[token]/        モバイルオーダー（客向け）
│  ├─ pos/                  POS レジ（フロアマップ / 伝票 / 会計 / レシート）
│  ├─ kds/                  キッチンディスプレイ
│  ├─ admin/                管理ダッシュボード
│  └─ api/                  ポーリング用の読み取り専用エンドポイント
├─ components/              画面をまたいで使う部品
└─ lib/
   ├─ actions/              Server Actions（書き込み）
   ├─ demo/                 デモモードのインメモリ実装（data.ts / repo.ts）
   ├─ queries.ts            読み取り
   ├─ auth.ts               PIN セッション（HMAC 署名 Cookie）
   ├─ supabase.ts           service_role クライアント / デモモード判定
   └─ types.ts              DB に対応する型

supabase/
├─ migrations/              スキーマ / 関数 / RLS
└─ seed.sql                 デモデータ
```
