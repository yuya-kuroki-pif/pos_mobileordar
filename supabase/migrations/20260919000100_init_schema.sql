-- ===========================================================================
-- POS + モバイルオーダー : 初期スキーマ
-- 金額はすべて「円（整数）」で保持する（JPY は最小単位が 1 円のため）
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 店舗
-- ---------------------------------------------------------------------------
create table public.stores (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  -- 消費税率。商品ごとに変える場合は menu_items.tax_rate で上書きする
  tax_rate            numeric(5, 4) not null default 0.1000,
  -- 内税(true) / 外税(false)。日本の飲食店は総額表示（内税）が一般的
  tax_included        boolean not null default true,
  -- サービス料（0.10 なら 10%）
  service_charge_rate numeric(5, 4) not null default 0.0000,
  -- スタッフ用ログイン PIN のハッシュ。crypt() で保存する
  staff_pin_hash      text,
  -- モバイルオーダーの受付可否
  mobile_order_open   boolean not null default true,
  opening_note        text,
  -- 営業日の区切り時刻。深夜 2 時の売上を前日扱いにするため、居酒屋では 5 時が一般的。
  -- 0 を指定すると暦日どおりの集計になる
  business_day_cutoff_hour integer not null default 5
    check (business_day_cutoff_hour between 0 and 12),
  -- 集計に使うタイムゾーン
  timezone            text not null default 'Asia/Tokyo',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.stores is '店舗マスタ。1 レコード = 1 店舗';

-- ---------------------------------------------------------------------------
-- 卓（テーブル）
-- ---------------------------------------------------------------------------
create table public.restaurant_tables (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  name        text not null,                       -- 例: "A-1", "カウンター3"
  area        text,                                -- 例: "1F", "テラス"
  seats       integer not null default 4,
  -- QR コードに埋め込むトークン。推測不能な値にする
  qr_token    text not null unique default encode(gen_random_bytes(16), 'hex'),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index on public.restaurant_tables (store_id, sort_order);
comment on column public.restaurant_tables.qr_token is 'QR コード URL /order/{qr_token} に使う推測不能トークン';

-- ---------------------------------------------------------------------------
-- メニューカテゴリ
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index on public.categories (store_id, sort_order);

-- ---------------------------------------------------------------------------
-- 商品
-- ---------------------------------------------------------------------------
create type public.prep_station as enum ('kitchen', 'bar', 'none');

create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  category_id   uuid references public.categories (id) on delete set null,
  name          text not null,
  description   text,
  price         integer not null check (price >= 0),        -- 税込価格（円）
  image_url     text,
  -- 商品ごとに税率を変える場合のみ設定（null なら店舗の tax_rate を使う）
  tax_rate      numeric(5, 4),
  -- 調理担当。KDS のタブ振り分けに使う
  prep_station  public.prep_station not null default 'kitchen',
  -- 販売中かどうか（メニューから下げる）
  is_available  boolean not null default true,
  -- 本日売切（一時的）
  is_sold_out   boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.menu_items (store_id, category_id, sort_order);

-- ---------------------------------------------------------------------------
-- オプション（サイズ / トッピング / 焼き加減 など）
-- ---------------------------------------------------------------------------
create table public.option_groups (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  name        text not null,                    -- 例: "サイズ", "トッピング"
  min_select  integer not null default 0,
  max_select  integer not null default 1,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint option_group_select_range check (min_select >= 0 and max_select >= min_select)
);

create table public.options (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.option_groups (id) on delete cascade,
  name         text not null,                   -- 例: "大盛り"
  price_delta  integer not null default 0,      -- 加算額（円）。マイナスも可
  sort_order   integer not null default 0,
  is_available boolean not null default true
);

create index on public.options (group_id, sort_order);

-- 商品 ↔ オプショングループ（多対多）
create table public.menu_item_option_groups (
  menu_item_id    uuid not null references public.menu_items (id) on delete cascade,
  option_group_id uuid not null references public.option_groups (id) on delete cascade,
  sort_order      integer not null default 0,
  primary key (menu_item_id, option_group_id)
);

-- ---------------------------------------------------------------------------
-- 来店セッション（= 会計の単位。「卓を開ける」から「会計する」まで）
-- ---------------------------------------------------------------------------
create type public.session_status as enum ('open', 'bill_requested', 'closed', 'cancelled');

create table public.table_sessions (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  table_id      uuid not null references public.restaurant_tables (id) on delete restrict,
  guest_count   integer not null default 1 check (guest_count > 0),
  status        public.session_status not null default 'open',
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  note          text
);

create index on public.table_sessions (store_id, status);
create index on public.table_sessions (table_id, status);

-- 1 つの卓で同時に開けるセッションは 1 つだけ（クローズ済みは何件でも可）
create unique index table_sessions_one_open_per_table
  on public.table_sessions (table_id)
  where status in ('open', 'bill_requested');

comment on table public.table_sessions is '来店セッション。卓を開けてから会計するまでが 1 レコード';

-- ---------------------------------------------------------------------------
-- 注文（1 回の「注文する」操作 = 1 レコード）
-- ---------------------------------------------------------------------------
create type public.order_channel as enum ('mobile', 'pos');

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  session_id    uuid not null references public.table_sessions (id) on delete cascade,
  -- 店舗ごとの日次連番。伝票番号として表示する
  order_number  integer not null,
  channel       public.order_channel not null,
  note          text,
  placed_at     timestamptz not null default now()
);

create index on public.orders (store_id, placed_at desc);
create index on public.orders (session_id, placed_at);

-- ---------------------------------------------------------------------------
-- 注文明細（KDS が扱う最小単位。1 品ごとに調理ステータスを持つ）
-- ---------------------------------------------------------------------------
create type public.order_item_status as enum ('pending', 'cooking', 'ready', 'served', 'cancelled');

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores (id) on delete cascade,
  order_id         uuid not null references public.orders (id) on delete cascade,
  session_id       uuid not null references public.table_sessions (id) on delete cascade,
  menu_item_id     uuid references public.menu_items (id) on delete set null,
  -- 注文時点の商品名・価格を固定保存する。後でメニューを変えても伝票は変わらない
  name_snapshot    text not null,
  unit_price       integer not null check (unit_price >= 0),
  options_price    integer not null default 0,
  -- 選択したオプションの実体コピー
  -- 例: [{"group":"サイズ","name":"大盛り","price_delta":100}]
  options_snapshot jsonb not null default '[]'::jsonb,
  quantity         integer not null default 1 check (quantity > 0),
  tax_rate         numeric(5, 4) not null default 0.1000,
  prep_station     public.prep_station not null default 'kitchen',
  status           public.order_item_status not null default 'pending',
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 明細の税込小計。常に (単価 + オプション) × 数量
  line_total       integer generated always as ((unit_price + options_price) * quantity) stored
);

create index on public.order_items (session_id);
create index on public.order_items (store_id, status, created_at);
create index on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- 会計
-- ---------------------------------------------------------------------------
create type public.payment_method as enum ('cash', 'card', 'qr', 'e_money', 'other');
create type public.payment_status as enum ('paid', 'refunded');

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores (id) on delete cascade,
  session_id      uuid not null references public.table_sessions (id) on delete restrict,
  method          public.payment_method not null,
  -- 会計時点の金額内訳をすべて固定保存する（後から税率が変わっても再計算しない）
  subtotal        integer not null,            -- 明細合計（税込）
  discount        integer not null default 0,
  service_charge  integer not null default 0,
  tax             integer not null default 0,  -- 内税の場合は「内訳としての消費税額」
  total           integer not null,
  received        integer not null default 0,  -- 預かり金（現金のみ）
  change_due      integer not null default 0,  -- おつり
  status          public.payment_status not null default 'paid',
  note            text,
  paid_at         timestamptz not null default now()
);

create index on public.payments (store_id, paid_at desc);
create unique index payments_one_per_session on public.payments (session_id) where status = 'paid';

-- ---------------------------------------------------------------------------
-- updated_at 自動更新
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stores_touch      before update on public.stores      for each row execute function public.touch_updated_at();
create trigger menu_items_touch  before update on public.menu_items  for each row execute function public.touch_updated_at();
create trigger order_items_touch before update on public.order_items for each row execute function public.touch_updated_at();
