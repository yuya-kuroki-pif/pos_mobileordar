-- ===========================================================================
-- P1: プラン（仕様書 §5.4 / §8.2）
--
-- プラン = 飲み放題・コースなど「時間制限つきで、複数カテゴリのメニューを
-- 0 円で注文できる」商品。価格はプランオプションの選択肢が持つ
-- （例: 人数 × 2,500 円）。
-- ===========================================================================

create type public.plan_option_input as enum ('count', 'select');

-- プランをまとめる任意のグループ（一覧の絞り込みに使う）
create table public.plan_groups (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null,
  display_order integer not null default 0
);

create table public.plans (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  name                 text not null,
  receipt_display_name text,
  handy_display_name   text,
  -- プラン自体を置くカテゴリ（メニュー一覧と同じ並びに出すため）
  category_id          uuid references public.categories (id) on delete set null,
  plan_group_id        uuid references public.plan_groups (id) on delete set null,
  description          text,
  -- 制限時間。has_time_limit が false なら無制限
  has_time_limit       boolean not null default true,
  time_limit_min       integer,
  -- 終了通知（終了の何分前に知らせるか）
  has_end_notice       boolean not null default false,
  end_notice_min       integer,
  featured_label       text,
  image_url            text,
  image_size           public.image_size not null default 'medium',
  tax_method           public.tax_method not null default 'incl',
  tax_rate             numeric(5, 4) not null default 0.1000,
  display_order        integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index on public.plans (company_id, display_order);

-- プランオプション（例: 「人数」を個数入力させる）
create table public.plan_options (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.plans (id) on delete cascade,
  name          text not null,
  input_type    public.plan_option_input not null default 'count',
  min_kinds     integer not null default 1,
  max_kinds     integer not null default 1,
  display_order integer not null default 0
);

create index on public.plan_options (plan_id, display_order);

-- プランオプションの選択肢。プランの価格はここが持つ
create table public.plan_choices (
  id             uuid primary key default gen_random_uuid(),
  plan_option_id uuid not null references public.plan_options (id) on delete cascade,
  name           text not null,
  price          integer not null default 0,
  is_default     boolean not null default false,
  -- 個数入力のときの上限。null は無制限
  max_count      integer,
  display_order  integer not null default 0
);

create index on public.plan_choices (plan_option_id, display_order);

-- プラン内カテゴリ。プランの中だけで使う品目の区分
create table public.plan_categories (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.plans (id) on delete cascade,
  name          text not null,
  display_order integer not null default 0
);

create index on public.plan_categories (plan_id, display_order);

-- プラン内メニュー。プラン注文中は price（既定 0 円）で頼める
create table public.plan_menus (
  plan_id          uuid not null references public.plans (id) on delete cascade,
  plan_category_id uuid not null references public.plan_categories (id) on delete cascade,
  menu_id          uuid not null references public.menus (id) on delete cascade,
  price            integer not null default 0,
  display_order    integer not null default 0,
  primary key (plan_id, plan_category_id, menu_id)
);

create index on public.plan_menus (menu_id);

-- 自動注文設定。プランを注文した時点で自動的に注文が入るメニュー
create table public.plan_first_order_menus (
  plan_id uuid not null references public.plans (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete cascade,
  primary key (plan_id, menu_id)
);

-- 店舗ごとの取扱設定（メニューの shop_menus と同じ考え方）
create table public.shop_plans (
  shop_id               uuid not null references public.shops (id) on delete cascade,
  plan_id               uuid not null references public.plans (id) on delete cascade,
  is_dealing            boolean not null default true,
  is_visible_customer   boolean not null default true,
  is_visible_staff      boolean not null default true,
  in_stock              boolean not null default true,
  kitchen_printer_id    uuid references public.kitchen_printers (id) on delete set null,
  dish_up_slip_group_id uuid references public.dish_up_slip_groups (id) on delete set null,
  display_order         integer not null default 0,
  primary key (shop_id, plan_id)
);

create index on public.shop_plans (plan_id);

-- 多言語（メニューと同じ形）
create table public.plan_translations (
  plan_id        uuid not null references public.plans (id) on delete cascade,
  locale         public.locale not null,
  name           text,
  description    text,
  featured_label text,
  primary key (plan_id, locale)
);

create trigger plans_touch before update on public.plans
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS。他と同じく全拒否で、アクセスはサーバー経由のみ
-- ---------------------------------------------------------------------------
alter table public.plan_groups            enable row level security;
alter table public.plans                  enable row level security;
alter table public.plan_options           enable row level security;
alter table public.plan_choices           enable row level security;
alter table public.plan_categories        enable row level security;
alter table public.plan_menus             enable row level security;
alter table public.plan_first_order_menus enable row level security;
alter table public.shop_plans             enable row level security;
alter table public.plan_translations      enable row level security;

revoke all on table
  public.plan_groups, public.plans, public.plan_options, public.plan_choices,
  public.plan_categories, public.plan_menus, public.plan_first_order_menus,
  public.shop_plans, public.plan_translations
from anon, authenticated;
