-- ===========================================================================
-- P1 マスター: メニューマスターを業態単位へ移す（仕様書 §8.2 / §8.3）
--
-- これまで店舗単位（store_id）で持っていたメニュー・オプションを、
-- 業態単位（company_id）へ移し、店舗ごとの扱いは shop_menus で持つ。
--
-- テーブル名も指示書の語彙へ寄せる:
--   menu_items              → menus
--   option_groups           → options
--   options（選択肢）        → choices
--   menu_item_option_groups → menu_options
--
-- 名前が入れ替わるため、改名の順序に注意（先に choices へ逃がす）。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. 選択肢 options → choices（先に逃がす）
-- ---------------------------------------------------------------------------
alter table public.options rename to choices;
alter table public.choices rename column group_id    to option_id;
alter table public.choices rename column price_delta to price;
alter table public.choices rename column sort_order  to display_order;

alter table public.choices
  add column receipt_display_name text,
  add column cost_price     integer,
  add column cost_tax_rate  numeric(5, 4),
  add column is_default     boolean not null default false,
  add column menu_type      text,
  add column image_url      text;

-- ---------------------------------------------------------------------------
-- 2. オプショングループ option_groups → options
-- ---------------------------------------------------------------------------
alter table public.option_groups rename to options;
alter table public.options rename column min_select to min_choice;
alter table public.options rename column max_select to max_choice;
alter table public.options rename column sort_order to display_order;

alter table public.options
  add column company_id uuid references public.companies (id) on delete cascade,
  add column receipt_display_name text;

-- ---------------------------------------------------------------------------
-- 3. カテゴリを業態単位へ
-- ---------------------------------------------------------------------------
alter table public.categories
  add column company_id          uuid references public.companies (id) on delete cascade,
  add column staff_display_name  text,
  add column handy_bg_color      text,
  add column kds_color           text;

alter table public.categories rename column sort_order to display_order;

-- ---------------------------------------------------------------------------
-- 4. メニュー menu_items → menus
-- ---------------------------------------------------------------------------
create type public.menu_type      as enum ('food', 'drink', 'other');
create type public.image_size     as enum ('large', 'medium', 'small', 'hidden');
create type public.tax_method     as enum ('incl', 'excl');

alter table public.menu_items rename to menus;
alter table public.menus rename column sort_order to display_order;

alter table public.menus
  add column company_id            uuid references public.companies (id) on delete cascade,
  add column receipt_display_name  text,
  add column staff_display_name    text,
  add column featured_label        text,
  add column menu_type             public.menu_type not null default 'food',
  add column image_size            public.image_size not null default 'medium',
  add column tax_method            public.tax_method not null default 'incl',
  -- 商品ごとの税率（仕様書 §5.3 の「税率 10% / 8%」）。
  -- 持ち帰りで動的に 8% へ落とす判定は reduced_rate_eligible 側で行う（後述）
  add column tax_rate              numeric(5, 4) not null default 0.1000,
  add column cost_price            integer,
  add column cost_tax_rate         numeric(5, 4),
  -- 店外メニュー（テイクアウト/デリバリー売上として集計）
  add column is_takeout            boolean not null default false,
  -- ハンディで都度価格を入力する。モバイルオーダーには出さない
  add column is_free_key           boolean not null default false,
  -- 「ご案内」のように説明文だけを置く、注文できないメニュー（§5.6）
  add column is_notice_only        boolean not null default false,
  add column min_order_per_order   integer,
  add column max_per_table_visit   integer,
  add column max_per_person_visit  integer,
  add column max_per_table_order   integer,
  add column max_per_person_order  integer;

comment on column public.menus.reduced_rate_eligible is
  '持ち帰り時に軽減税率を適用できる商品か。酒類・非飲食料品は false。'
  '仕様書には無い拡張で、テイクアウト時に税率を動的に切り替えるために使う';

-- ---------------------------------------------------------------------------
-- 5. カテゴリとメニューを多対多にする（§8.2 の category_menus）
--    1 つのメニューを複数カテゴリに置けるようにするため
-- ---------------------------------------------------------------------------
create table public.category_menus (
  category_id   uuid not null references public.categories (id) on delete cascade,
  menu_id       uuid not null references public.menus (id) on delete cascade,
  display_order integer not null default 0,
  primary key (category_id, menu_id)
);

create index on public.category_menus (menu_id);

-- 既存の menus.category_id を移す
insert into public.category_menus (category_id, menu_id, display_order)
select m.category_id, m.id, m.display_order
from public.menus m
where m.category_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 6. メニュー ↔ オプション menu_item_option_groups → menu_options
-- ---------------------------------------------------------------------------
alter table public.menu_item_option_groups rename to menu_options;
alter table public.menu_options rename column menu_item_id    to menu_id;
alter table public.menu_options rename column option_group_id to option_id;
alter table public.menu_options rename column sort_order      to display_order;

-- ---------------------------------------------------------------------------
-- 7. 多言語（§8.2 の menu_translations）
-- ---------------------------------------------------------------------------
create type public.locale as enum ('en', 'zh-CN', 'ko', 'ne', 'vi', 'my');

create table public.menu_translations (
  menu_id        uuid not null references public.menus (id) on delete cascade,
  locale         public.locale not null,
  name           text,
  description    text,
  featured_label text,
  primary key (menu_id, locale)
);

create table public.option_translations (
  option_id uuid not null references public.options (id) on delete cascade,
  locale    public.locale not null,
  name      text,
  primary key (option_id, locale)
);

create table public.choice_translations (
  choice_id uuid not null references public.choices (id) on delete cascade,
  locale    public.locale not null,
  name      text,
  primary key (choice_id, locale)
);

-- ---------------------------------------------------------------------------
-- 8. キッチンプリンター（§8.3 の roles）とデシャップグループ
--    RBAC の roles_definitions とは別物。仕様書の語彙に従う
-- ---------------------------------------------------------------------------
create table public.kitchen_printers (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  name          text not null,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

comment on table public.kitchen_printers is
  '仕様書 §8.3 の roles にあたる。RBAC の roles_definitions と紛らわしいため'
  'kitchen_printers という名前にしている';

create table public.dish_up_slip_groups (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  name          text not null,
  display_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- 9. 店舗ごとの取扱設定（§8.3 の shop_menus）
-- ---------------------------------------------------------------------------
create table public.shop_menus (
  shop_id              uuid not null references public.shops (id) on delete cascade,
  menu_id              uuid not null references public.menus (id) on delete cascade,
  is_dealing           boolean not null default true,
  is_visible_customer  boolean not null default true,
  is_visible_staff     boolean not null default true,
  in_stock             boolean not null default true,
  -- null は「無制限」
  stock_qty            integer,
  -- 毎日リセットされる在庫数。null は「未設定」
  daily_stock_qty      integer,
  kitchen_printer_id   uuid references public.kitchen_printers (id) on delete set null,
  dish_up_slip_group_id uuid references public.dish_up_slip_groups (id) on delete set null,
  display_order        integer not null default 0,
  primary key (shop_id, menu_id)
);

create index on public.shop_menus (menu_id);

-- ---------------------------------------------------------------------------
-- 10. 既存データの移行
--     これまで店舗直下にあったマスターを、その店舗の業態へ持ち上げる。
--     店舗ごとの公開・在庫は shop_menus へ移す。
-- ---------------------------------------------------------------------------
update public.categories c
set company_id = s.company_id
from public.shops s
where c.store_id = s.id and c.company_id is null;

update public.menus m
set company_id = s.company_id,
    receipt_display_name = coalesce(m.receipt_display_name, m.name),
    menu_type = case when m.prep_station = 'bar' then 'drink'::public.menu_type
                     else 'food'::public.menu_type end
from public.shops s
where m.store_id = s.id and m.company_id is null;

update public.options o
set company_id = s.company_id,
    receipt_display_name = coalesce(o.receipt_display_name, o.name)
from public.shops s
where o.store_id = s.id and o.company_id is null;

update public.choices ch
set receipt_display_name = coalesce(ch.receipt_display_name, ch.name)
where ch.receipt_display_name is null;

-- 取扱設定を作る。これまでの is_available / is_sold_out を店舗側へ移す
insert into public.shop_menus (
  shop_id, menu_id, is_dealing, is_visible_customer, is_visible_staff, in_stock, display_order
)
select m.store_id, m.id, true, m.is_available, m.is_available, not m.is_sold_out, m.display_order
from public.menus m
where m.store_id is not null
on conflict do nothing;

-- 移行が済んだので業態必須にし、店舗への参照を落とす
alter table public.categories alter column company_id set not null;
alter table public.menus      alter column company_id set not null;
alter table public.options    alter column company_id set not null;

alter table public.categories drop column store_id;
alter table public.menus      drop column store_id;
alter table public.options    drop column store_id;

-- カテゴリは category_menus へ移したので単一参照を落とす
alter table public.menus drop column category_id;

-- 店舗ごとの状態は shop_menus が持つ
alter table public.menus drop column is_available;
alter table public.menus drop column is_sold_out;

create index on public.categories (company_id, display_order);
create index on public.menus (company_id, display_order);
create index on public.options (company_id, display_order);

-- ---------------------------------------------------------------------------
-- 11. 注文明細の参照先を menus に合わせる
-- ---------------------------------------------------------------------------
alter table public.order_items rename column menu_item_id to menu_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.category_menus      enable row level security;
alter table public.menu_translations   enable row level security;
alter table public.option_translations enable row level security;
alter table public.choice_translations enable row level security;
alter table public.kitchen_printers    enable row level security;
alter table public.dish_up_slip_groups enable row level security;
alter table public.shop_menus          enable row level security;

revoke all on table
  public.category_menus, public.menu_translations, public.option_translations,
  public.choice_translations, public.kitchen_printers, public.dish_up_slip_groups,
  public.shop_menus
from anon, authenticated;
