-- ===========================================================================
-- P2: 取引・本部機能（仕様書 §5.22〜§5.28 / §8.5）
--
-- 会計そのものは Phase A で作った payments が担っているので、§8.5 の
-- accountings を別に作らず、payments に足りない列を足して兼ねさせる。
-- 新しく要るのは、監査ログ・領収証・銀行預入金の修正履歴・決済端末まわり。
-- ===========================================================================

-- 卓の利用履歴（§5.25）に要る列
alter table public.table_sessions
  add column parent_session_id uuid references public.table_sessions (id) on delete set null,
  add column clear_reason      text,
  add column inflow_source_id  uuid references public.inflow_sources (id) on delete set null;

create index on public.table_sessions (store_id, opened_at desc);

-- 会計まわり（§5.23）
alter table public.payments
  add column receipt_number bigint,
  add column clerk_id       uuid references public.clerks (id) on delete set null,
  add column guest_count    integer,
  add column inflow_source_id uuid references public.inflow_sources (id) on delete set null,
  add column payment_method_id uuid references public.payment_methods (id) on delete set null,
  add column modified_at    timestamptz;

create index on public.payments (store_id, receipt_number);

create table public.accounting_discounts (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null references public.payments (id) on delete cascade,
  discount_type_id uuid references public.discount_types (id) on delete set null,
  amount           integer not null default 0
);

create index on public.accounting_discounts (payment_id);

create table public.receipts (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments (id) on delete cascade,
  issued_at    timestamptz not null default now(),
  is_temporary boolean not null default false,
  issued_to    text
);

create index on public.receipts (payment_id);

-- 重要操作履歴（§5.26）
create type public.audit_event as enum (
  'drawer_open', 'discount', 'void', 'table_clear',
  'accounting_modify', 'cash_in', 'cash_out', 'price_override'
);

create table public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  event_type     public.audit_event not null,
  occurred_at    timestamptz not null default now(),
  table_id       uuid references public.restaurant_tables (id) on delete set null,
  clerk_id       uuid references public.clerks (id) on delete set null,
  amount         integer,
  receipt_number bigint,
  note           text
);

create index on public.audit_logs (shop_id, occurred_at desc);
create index on public.audit_logs (event_type);

-- 日次処理（§5.22）
alter table public.cash_drawer_closings
  add column closing_index   integer not null default 0,
  add column total_sales     integer not null default 0,
  add column guest_count     integer not null default 0,
  add column group_count     integer not null default 0,
  add column bank_deposit    integer not null default 0,
  add column carryover_fund  integer not null default 0,
  add column denomination_counts jsonb not null default '{}'::jsonb;

create unique index cash_drawer_closings_day_index
  on public.cash_drawer_closings (store_id, business_day, closing_index);

create table public.bank_deposit_corrections (
  id            uuid primary key default gen_random_uuid(),
  closing_id    uuid not null references public.cash_drawer_closings (id) on delete cascade,
  corrected_at  timestamptz not null default now(),
  reason        text,
  before_amount integer not null,
  after_amount  integer not null,
  account_id    uuid references public.accounts (id) on delete set null
);

create index on public.bank_deposit_corrections (closing_id, corrected_at desc);

-- キャッシュレス決済（§5.24）
create table public.terminal_payments (
  id                   uuid primary key default gen_random_uuid(),
  shop_id              uuid not null references public.shops (id) on delete cascade,
  transaction_id       text not null,
  kind                 text,
  method               text,
  status               text not null default 'captured',
  occurred_at          timestamptz not null default now(),
  amount               integer not null default 0,
  fee                  integer not null default 0,
  fee_rate             numeric(6, 4) not null default 0,
  net                  integer not null default 0,
  brand                text,
  issuer_country       text,
  masked_pan           text,
  cycle_start          date,
  cycle_end            date,
  refund_requested_at  timestamptz
);

create index on public.terminal_payments (shop_id, occurred_at desc);

create table public.terminal_deposits (
  id             uuid primary key default gen_random_uuid(),
  corporation_id uuid not null references public.corporations (id) on delete cascade,
  requested_at   date,
  executed_at    date,
  bank_account   text,
  cycle_start    date,
  cycle_end      date,
  amount         integer not null default 0,
  sales          integer not null default 0,
  fee            integer not null default 0,
  tax            integer not null default 0,
  adjustment     integer not null default 0,
  carryover      integer not null default 0,
  cycle_type     text,
  status         text not null default 'scheduled',
  statement_no   text
);

create index on public.terminal_deposits (corporation_id, executed_at desc);

-- レポートくん設定（§5.27）
create table public.line_reporting_bot_configs (
  id             uuid primary key default gen_random_uuid(),
  corporation_id uuid not null references public.corporations (id) on delete cascade,
  group_name     text not null,
  line_group_id  text,
  shop_ids       uuid[] not null default '{}',
  send_time_min  integer not null default 23 * 60 check (send_time_min between 0 and 1860),
  items          jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index on public.line_reporting_bot_configs (corporation_id, is_active);

-- RLS
alter table public.accounting_discounts       enable row level security;
alter table public.receipts                   enable row level security;
alter table public.audit_logs                 enable row level security;
alter table public.bank_deposit_corrections   enable row level security;
alter table public.terminal_payments          enable row level security;
alter table public.terminal_deposits          enable row level security;
alter table public.line_reporting_bot_configs enable row level security;

revoke all on table
  public.accounting_discounts, public.receipts, public.audit_logs,
  public.bank_deposit_corrections, public.terminal_payments,
  public.terminal_deposits, public.line_reporting_bot_configs
from anon, authenticated;
