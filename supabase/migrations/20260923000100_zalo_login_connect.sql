-- ===========================================================================
-- Zalo ログイン連携（案A）
--
-- モバイルオーダーを開いたお客様を Zalo アカウントで特定し、
-- OA のフォローと ZNS 配信につなげる。
-- dinii の LINE ミニアプリに当たる部分を、既存の Web モバイルオーダーのまま実現する。
-- 将来 Zalo Mini App（案B）へ移るときも、顧客の持ち方はこのまま使える。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- お客様側。同意は「いつ取ったか」まで残す
-- （ベトナムの個人データ保護・広告メッセージ規制で、同意の記録が要るため）
-- ---------------------------------------------------------------------------
alter table public.customers
  add column zalo_followed_at     timestamptz,
  add column marketing_consent    boolean not null default false,
  add column marketing_consent_at timestamptz;

create index on public.customers (corporation_id, zalo_user_id);

comment on column public.customers.marketing_consent is
  '販促メッセージの受信に同意したか。同意なしに ZNS の販促テンプレートを送らないこと';

-- ---------------------------------------------------------------------------
-- 業態ごとの連携設定。
-- app secret や access token は環境変数に置き、ここには持たせない
-- ---------------------------------------------------------------------------
create type public.zalo_login_mode as enum ('off', 'optional', 'required');

create table public.zalo_connect_settings (
  company_id       uuid primary key references public.companies (id) on delete cascade,
  -- Zalo Developers のアプリ ID（公開値）
  app_id           text,
  -- Official Account の ID。フォロー導線のリンクに使う
  oa_id            text,
  -- off: 出さない / optional: 出すがスキップできる / required: 連携しないと注文できない
  login_mode       public.zalo_login_mode not null default 'optional',
  -- フォローしてくれた方に渡す特典
  follow_coupon_id uuid references public.coupons (id) on delete set null,
  -- 画面に出す一言（多言語はアプリ側の辞書で持つ）
  headline         text,
  updated_at       timestamptz not null default now()
);

comment on table public.zalo_connect_settings is
  'Zalo ログイン連携の業態ごとの設定。秘密鍵は環境変数に置く';

-- ---------------------------------------------------------------------------
-- RLS。他と同じく全拒否で、アクセスはサーバー経由のみ
-- ---------------------------------------------------------------------------
alter table public.zalo_connect_settings enable row level security;
revoke all on table public.zalo_connect_settings from anon, authenticated;
