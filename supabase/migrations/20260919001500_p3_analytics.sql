-- ===========================================================================
-- P3: 分析（仕様書 §5.1 / §6.x / §8.7）
--
-- 集計は payments と order_items から都度計算する。指示書は日次マテビューを
-- 想定しているが、この規模なら素直に集計して十分で、数字も古くならない。
-- 重くなってきたらここをマテビューへ寄せる。
-- ===========================================================================

create type public.pl_section as enum ('sales', 'cogs', 'labor', 'sga');
create type public.cost_class as enum ('variable', 'fixed');
create type public.product_type as enum ('food', 'drink', 'other');
create type public.entry_source as enum ('manual', 'auto', 'csv');

create table public.pl_accounts (
  id                uuid primary key default gen_random_uuid(),
  corporation_id    uuid not null references public.corporations (id) on delete cascade,
  code              text,
  pl_section        public.pl_section not null,
  name              text not null,
  sub_name          text,
  cost_class        public.cost_class,
  petty_cash_usable boolean not null default false,
  is_visible        boolean not null default true,
  company_ids       uuid[] not null default '{}',
  note              text,
  display_order     integer not null default 0
);

create index on public.pl_accounts (corporation_id, display_order);

create table public.vendors (
  id             uuid primary key default gen_random_uuid(),
  corporation_id uuid not null references public.corporations (id) on delete cascade,
  name           text not null,
  kind           text,
  note           text,
  display_order  integer not null default 0
);

create index on public.vendors (corporation_id, display_order);

create table public.purchase_transactions (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  purchased_on date not null,
  vendor_id    uuid references public.vendors (id) on delete set null,
  product_name text not null,
  spec         text,
  product_type public.product_type not null default 'food',
  unit_price   integer not null default 0,
  quantity     numeric(12, 2) not null default 1,
  amount       integer not null default 0,
  source       public.entry_source not null default 'manual',
  note         text
);

create index on public.purchase_transactions (shop_id, purchased_on desc);

create table public.petty_cash_transactions (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  occurred_on   date not null,
  pl_account_id uuid references public.pl_accounts (id) on delete set null,
  vendor_id     uuid references public.vendors (id) on delete set null,
  amount        integer not null default 0,
  kind          text not null default 'out',
  note          text
);

create index on public.petty_cash_transactions (shop_id, occurred_on desc);

create table public.income_expense_transactions (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  occurred_on   date not null,
  pl_account_id uuid references public.pl_accounts (id) on delete set null,
  vendor_id     uuid references public.vendors (id) on delete set null,
  amount        integer not null default 0,
  note          text
);

create index on public.income_expense_transactions (shop_id, occurred_on desc);

create table public.kpi_targets (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  year_month        text not null,
  sales_target      integer not null default 0,
  food_cost_target  integer not null default 0,
  drink_cost_target integer not null default 0,
  labor_target      integer not null default 0,
  sga_target        integer not null default 0,
  guest_target      integer not null default 0,
  avg_spend_target  integer not null default 0,
  score_targets     jsonb not null default '{}'::jsonb,
  unique (shop_id, year_month)
);

create table public.daily_sales_targets (
  shop_id       uuid not null references public.shops (id) on delete cascade,
  business_date date not null,
  amount        integer not null default 0,
  primary key (shop_id, business_date)
);

create table public.daily_reports (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  business_date date not null,
  weather       text,
  comment       text,
  updated_at    timestamptz not null default now(),
  unique (shop_id, business_date)
);

create table public.custom_reports (
  id               uuid primary key default gen_random_uuid(),
  corporation_id   uuid not null references public.corporations (id) on delete cascade,
  name             text not null,
  owner_account_id uuid references public.accounts (id) on delete set null,
  share_scope      text not null default 'private',
  definition       jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);

create index on public.custom_reports (corporation_id);

alter table public.pl_accounts                 enable row level security;
alter table public.vendors                     enable row level security;
alter table public.purchase_transactions       enable row level security;
alter table public.petty_cash_transactions     enable row level security;
alter table public.income_expense_transactions enable row level security;
alter table public.kpi_targets                 enable row level security;
alter table public.daily_sales_targets         enable row level security;
alter table public.daily_reports               enable row level security;
alter table public.custom_reports              enable row level security;

revoke all on table
  public.pl_accounts, public.vendors, public.purchase_transactions,
  public.petty_cash_transactions, public.income_expense_transactions,
  public.kpi_targets, public.daily_sales_targets, public.daily_reports,
  public.custom_reports
from anon, authenticated;
