-- ===========================================================================
-- フェーズ A: レジとして成立させるためのスキーマ拡張
--
--   1. 軽減税率 8%（テイクアウト区分）
--   2. インボイス制度対応
--   3. 分割会計・卓移動・伝票結合
--   4. レジ締め・現金在高管理
--   5. 会計後の返品・取消
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. 税率まわり
--
-- 日本の消費税は「店内飲食 = 10%」「飲食料品の持ち帰り = 8%」。
-- ただし酒類は持ち帰りでも 10%。この判定に必要な情報を持たせる。
-- ---------------------------------------------------------------------------

-- 店舗の tax_rate は「標準税率」であることを名前で明示する
alter table public.stores rename column tax_rate to standard_tax_rate;

alter table public.stores
  add column reduced_tax_rate numeric(5, 4) not null default 0.0800,
  -- 適格請求書発行事業者の登録番号（例: T1234567890123）
  add column invoice_registration_number text,
  -- レジ締め時の釣銭準備金の既定値
  add column cash_float_default integer not null default 0;

comment on column public.stores.standard_tax_rate is '標準税率。店内飲食に適用する';
comment on column public.stores.reduced_tax_rate is '軽減税率。持ち帰りの飲食料品に適用する';

-- 提供形態
create type public.service_type as enum ('eat_in', 'takeout');

-- 商品が「持ち帰りなら軽減税率」の対象かどうか。
-- 酒類・非飲食料品（グッズ等）は false にする。
alter table public.menu_items
  add column reduced_rate_eligible boolean not null default true;

comment on column public.menu_items.reduced_rate_eligible is
  '持ち帰り時に軽減税率 8% を適用できる商品か。酒類・非飲食料品は false';

-- menu_items.tax_rate（商品ごとの税率直接指定）は
-- reduced_rate_eligible と役割が重複し、どちらが優先か曖昧になるため廃止する
alter table public.menu_items drop column tax_rate;

-- 来店セッションと注文の提供形態。
-- セッションが既定値を持ち、注文ごとに上書きできる
-- （店内飲食の途中でデザートだけ持ち帰る、といったケースがあるため）
alter table public.table_sessions
  add column service_type public.service_type not null default 'eat_in';

alter table public.orders
  add column service_type public.service_type not null default 'eat_in';

-- ---------------------------------------------------------------------------
-- 3. 分割会計・伝票結合
-- ---------------------------------------------------------------------------

-- 伝票結合で吸収された側のセッションを表す状態
alter type public.session_status add value if not exists 'merged';

-- 1 セッションに複数回の会計を許すため、単一会計の制約を外す
drop index if exists public.payments_one_per_session;

alter table public.payments
  -- 税率別の内訳。[{"rate":0.10,"taxable":3300,"tax":300}, ...]
  -- インボイスの記載要件（税率ごとの合計額と消費税額）を満たすために保存する
  add column tax_breakdown jsonb not null default '[]'::jsonb,
  -- 人数割りのとき何分割の何番目か
  add column split_count integer not null default 1 check (split_count > 0),
  add column split_index integer not null default 1 check (split_index > 0),
  -- 会計取消の記録
  add column voided_at timestamptz,
  add column void_reason text;

-- どの明細がどの会計で支払われたか。
-- null = 未会計。明細指定の分割会計で使う
alter table public.order_items
  add column payment_id uuid references public.payments (id) on delete set null;

create index on public.order_items (payment_id);

comment on column public.order_items.payment_id is
  '支払い済みの会計。null は未会計。明細を指定した分割会計で使う';

-- ---------------------------------------------------------------------------
-- 4. 現金在高・レジ締め
-- ---------------------------------------------------------------------------

-- 入金と出金の 2 種類だけにする。
-- 「釣銭準備金」を別種別にすると締め時の理論在高で二重計上しやすいため、
-- 準備金は締め画面の opening_float として扱う。
create type public.cash_movement_kind as enum (
  'deposit',    -- 入金（両替・補充）
  'withdrawal'  -- 出金（銀行預け入れ・経費支払い）
);

create table public.cash_movements (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  business_day date not null,
  kind         public.cash_movement_kind not null,
  -- 必ず正の数で持ち、増減の向きは kind で判断する
  amount       integer not null check (amount > 0),
  reason       text,
  created_at   timestamptz not null default now()
);

create index on public.cash_movements (store_id, business_day);

create table public.cash_drawer_closings (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  business_day  date not null,
  opening_float integer not null default 0,
  cash_sales    integer not null default 0,  -- 現金会計の合計
  cash_in       integer not null default 0,  -- 入金合計
  cash_out      integer not null default 0,  -- 出金合計
  expected_cash integer not null default 0,  -- 理論在高
  counted_cash  integer not null default 0,  -- 実査額
  difference    integer not null default 0,  -- 実査額 - 理論在高（過不足）
  note          text,
  closed_at     timestamptz not null default now()
);

-- 1 営業日につき 1 回だけ締められる
create unique index cash_drawer_closings_one_per_day
  on public.cash_drawer_closings (store_id, business_day);

comment on table public.cash_drawer_closings is
  'レジ締め。理論在高と実査額の差異を記録し、現金の過不足を追えるようにする';

-- ---------------------------------------------------------------------------
-- RLS（新規テーブルも他と同じく全拒否。アクセスはサーバー経由のみ）
-- ---------------------------------------------------------------------------

alter table public.cash_movements        enable row level security;
alter table public.cash_drawer_closings  enable row level security;

revoke all on table public.cash_movements, public.cash_drawer_closings
  from anon, authenticated;
