-- ===========================================================================
-- P1 の残り（仕様書 §5.7 / §5.8 / §5.9 / §5.11 / §5.14〜§5.21）
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- §5.7 おすすめメニュー
-- ---------------------------------------------------------------------------
create table public.recommendation_sets (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null,
  display_name  text,
  display_order integer not null default 0
);

create index on public.recommendation_sets (company_id, display_order);

create table public.recommendation_menus (
  set_id        uuid not null references public.recommendation_sets (id) on delete cascade,
  menu_id       uuid not null references public.menus (id) on delete cascade,
  display_order integer not null default 0,
  primary key (set_id, menu_id)
);

-- 店舗ごとに、どのおすすめセットを出すか
create table public.shop_recommendations (
  shop_id    uuid primary key references public.shops (id) on delete cascade,
  set_id     uuid references public.recommendation_sets (id) on delete set null,
  is_visible boolean not null default false
);

-- ---------------------------------------------------------------------------
-- §5.9 自動翻訳設定（業態単位）
-- ---------------------------------------------------------------------------
create table public.auto_translation_settings (
  company_id      uuid primary key references public.companies (id) on delete cascade,
  is_enabled      boolean not null default false,
  target_menu     boolean not null default true,
  target_plan     boolean not null default true,
  target_option   boolean not null default true,
  target_category boolean not null default true,
  target_recommendation boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- §5.9 お通し自動設定
-- ---------------------------------------------------------------------------
create table public.compulsory_appetizers (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null,
  menu_id       uuid references public.menus (id) on delete set null,
  price         integer not null default 0,
  -- 0:00 からの分。深夜をまたぐ時間帯を書けるようにする
  start_min     integer not null default 0 check (start_min between 0 and 1860),
  end_min       integer not null default 1860 check (end_min between 0 and 1860),
  display_order integer not null default 0
);

create index on public.compulsory_appetizers (company_id, display_order);

-- 店舗ごとの自動注文 ON/OFF
create table public.shop_appetizers (
  shop_id      uuid not null references public.shops (id) on delete cascade,
  appetizer_id uuid not null references public.compulsory_appetizers (id) on delete cascade,
  is_auto_order boolean not null default false,
  primary key (shop_id, appetizer_id)
);

-- ---------------------------------------------------------------------------
-- §5.9 自動釣銭機設定（店舗単位）
-- ---------------------------------------------------------------------------
create table public.cash_changer_settings (
  shop_id               uuid primary key references public.shops (id) on delete cascade,
  -- 釣銭準備金の残置設定
  keep_float_in_changer boolean not null default false,
  -- 釣銭機外入金設定
  allow_external_deposit boolean not null default false,
  -- 緊急入出金設定
  allow_emergency_cash  boolean not null default false
);

-- ---------------------------------------------------------------------------
-- §5.11 モバイルオーダーデザイン設定（業態単位）
-- ---------------------------------------------------------------------------
create type public.mo_theme as enum ('light', 'dark');

create table public.mobile_order_designs (
  company_id      uuid primary key references public.companies (id) on delete cascade,
  menu_theme      public.mo_theme not null default 'light',
  checkin_theme   public.mo_theme not null default 'light',
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- §5.14 アプリ表示時間設定
-- ---------------------------------------------------------------------------
create table public.orderable_times (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index on public.orderable_times (company_id);

-- 曜日ごとの時間帯。day_of_week: 0=日 … 6=土、7=祝日。行が無い曜日は「表示しない」
create table public.orderable_time_slots (
  orderable_time_id uuid not null references public.orderable_times (id) on delete cascade,
  day_of_week       integer not null check (day_of_week between 0 and 7),
  start_min         integer not null check (start_min between 0 and 1860),
  end_min           integer not null check (end_min between 0 and 1860),
  primary key (orderable_time_id, day_of_week)
);

-- どの店舗がどのアプリ表示時間を使うか
create table public.shop_orderable_times (
  shop_id           uuid not null references public.shops (id) on delete cascade,
  orderable_time_id uuid not null references public.orderable_times (id) on delete cascade,
  primary key (shop_id, orderable_time_id)
);

-- ---------------------------------------------------------------------------
-- §5.15 キッチンプリンター一覧。P1 の初回で作った表へ設定列を足す
-- ---------------------------------------------------------------------------
create type public.print_sound as enum ('a', 'b', 'none');

alter table public.kitchen_printers
  add column notify_mobile_payment boolean not null default false,
  add column print_call_slip       boolean not null default false,
  add column print_checkout_slip   boolean not null default false,
  add column print_dish_up_slip    boolean not null default false,
  add column print_table_move_slip boolean not null default false,
  add column dish_up_layout        text,
  add column print_sound           public.print_sound not null default 'none',
  -- 緊急時の自動振替先
  add column fallback_printer_1_id uuid references public.kitchen_printers (id) on delete set null,
  add column fallback_printer_2_id uuid references public.kitchen_printers (id) on delete set null;

-- ---------------------------------------------------------------------------
-- §5.16 印刷オプション設定
-- ---------------------------------------------------------------------------
-- 調理アイテム
create table public.cooking_items (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references public.shops (id) on delete cascade,
  name               text not null,
  kitchen_printer_id uuid references public.kitchen_printers (id) on delete set null,
  display_order      integer not null default 0
);

create index on public.cooking_items (shop_id, display_order);

-- プランオプションごとの出力先
create table public.plan_option_printers (
  shop_id            uuid not null references public.shops (id) on delete cascade,
  plan_option_id     uuid not null references public.plan_options (id) on delete cascade,
  kitchen_printer_id uuid references public.kitchen_printers (id) on delete set null,
  primary key (shop_id, plan_option_id)
);

-- キッチン表示・印刷順。店舗ごとにカテゴリを並べ替える
create table public.shop_category_orders (
  shop_id       uuid not null references public.shops (id) on delete cascade,
  category_id   uuid not null references public.categories (id) on delete cascade,
  display_order integer not null default 0,
  primary key (shop_id, category_id)
);

-- ---------------------------------------------------------------------------
-- §5.17 店員。会計担当者の選択とスタッフ評価に使う
-- ---------------------------------------------------------------------------
create table public.clerks (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  name          text not null,
  is_visible    boolean not null default true,
  display_order integer not null default 0
);

create index on public.clerks (shop_id, display_order);

-- ---------------------------------------------------------------------------
-- §5.18 ハンディ管理。端末が自分で申告した情報を持つ
-- ---------------------------------------------------------------------------
create table public.handy_terminals (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  name           text not null,
  device_id      text,
  status         text not null default 'inactive',
  app_version    text,
  native_version text,
  brand          text,
  model          text,
  os_name        text,
  os_version     text,
  registered_at  timestamptz not null default now()
);

create index on public.handy_terminals (shop_id);

-- ---------------------------------------------------------------------------
-- §5.19 テーブル。これまで文字列だったエリアを実体にする
-- ---------------------------------------------------------------------------
create table public.areas (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  name          text not null,
  display_order integer not null default 0
);

create index on public.areas (shop_id, display_order);

-- qr_token（MO の起動 URL に載せる卓ごとの鍵）は初期スキーマで作ってあるので、
-- ここではエリアの参照だけを足す
alter table public.restaurant_tables
  add column area_id uuid references public.areas (id) on delete set null;

-- 既存の area（テキスト）を areas へ移す
do $$
declare
  r record;
  v_area uuid;
begin
  for r in
    select distinct store_id, coalesce(area, 'フロア') as area
    from public.restaurant_tables
  loop
    insert into public.areas (shop_id, name, display_order)
    values (r.store_id, r.area, 0)
    returning id into v_area;

    update public.restaurant_tables
    set area_id = v_area
    where store_id = r.store_id and coalesce(area, 'フロア') = r.area;
  end loop;
end $$;

update public.restaurant_tables
set qr_token = encode(gen_random_bytes(16), 'hex')
where qr_token is null;

-- ---------------------------------------------------------------------------
-- RLS。他と同じく全拒否で、アクセスはサーバー経由のみ
-- ---------------------------------------------------------------------------
alter table public.recommendation_sets       enable row level security;
alter table public.recommendation_menus      enable row level security;
alter table public.shop_recommendations      enable row level security;
alter table public.auto_translation_settings enable row level security;
alter table public.compulsory_appetizers     enable row level security;
alter table public.shop_appetizers           enable row level security;
alter table public.cash_changer_settings     enable row level security;
alter table public.mobile_order_designs      enable row level security;
alter table public.orderable_times           enable row level security;
alter table public.orderable_time_slots      enable row level security;
alter table public.shop_orderable_times      enable row level security;
alter table public.cooking_items             enable row level security;
alter table public.plan_option_printers      enable row level security;
alter table public.shop_category_orders      enable row level security;
alter table public.clerks                    enable row level security;
alter table public.handy_terminals           enable row level security;
alter table public.areas                     enable row level security;

revoke all on table
  public.recommendation_sets, public.recommendation_menus, public.shop_recommendations,
  public.auto_translation_settings, public.compulsory_appetizers, public.shop_appetizers,
  public.cash_changer_settings, public.mobile_order_designs,
  public.orderable_times, public.orderable_time_slots, public.shop_orderable_times,
  public.cooking_items, public.plan_option_printers, public.shop_category_orders,
  public.clerks, public.handy_terminals, public.areas
from anon, authenticated;
