-- ===========================================================================
-- P4: CRM（仕様書 §5.29〜§5.32 / §8.6）
-- ===========================================================================

create type public.customer_gender as enum ('male', 'female', 'other', 'unknown');
create type public.coupon_kind as enum ('benefit', 'discount', 'free_menu');
create type public.delivery_status as enum ('reserved', 'draft', 'suspended', 'sent');
create type public.delivery_target as enum ('all', 'filtered', 'line_ids');
create type public.delivery_content_kind as enum ('text', 'image', 'coupon', 'questionnaire');
create type public.questionnaire_kind as enum ('line', 'mobile_order');

create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  corporation_id uuid not null references public.corporations (id) on delete cascade,
  line_user_id   text,
  display_name   text,
  avatar_url     text,
  gender         public.customer_gender not null default 'unknown',
  birth_date     date,
  first_visit_at timestamptz,
  last_visit_at  timestamptz,
  visit_count    integer not null default 0,
  rank_name      text,
  created_at     timestamptz not null default now()
);

create index on public.customers (corporation_id, last_visit_at desc);

create table public.customer_visits (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers (id) on delete cascade,
  shop_id          uuid not null references public.shops (id) on delete cascade,
  table_session_id uuid references public.table_sessions (id) on delete set null,
  visited_at       timestamptz not null default now(),
  is_checkin       boolean not null default true
);

create index on public.customer_visits (shop_id, visited_at desc);

create table public.line_official_accounts (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  name           text not null,
  channel_id     text,
  monthly_quota  integer not null default 0,
  friends_total  integer not null default 0,
  friends_active integer not null default 0,
  blocked        integer not null default 0
);

create table public.coupons (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  kind             public.coupon_kind not null default 'benefit',
  name             text not null,
  display_name     text,
  content          text,
  description      text,
  terms            text,
  image_url        text,
  starts_at        timestamptz,
  ends_at          timestamptz,
  valid_days       integer,
  discount_type_id uuid references public.discount_types (id) on delete set null,
  menu_id          uuid references public.menus (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index on public.coupons (company_id, created_at desc);

create table public.customer_coupons (
  id           uuid primary key default gen_random_uuid(),
  coupon_id    uuid not null references public.coupons (id) on delete cascade,
  customer_id  uuid not null references public.customers (id) on delete cascade,
  issued_at    timestamptz not null default now(),
  used_at      timestamptz,
  used_shop_id uuid references public.shops (id) on delete set null
);

create index on public.customer_coupons (coupon_id);
create index on public.customer_coupons (customer_id);

create table public.coupon_presets (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  segment    text not null,
  enabled    boolean not null default false,
  coupon_id  uuid references public.coupons (id) on delete set null,
  unique (company_id, segment)
);

create table public.message_deliveries (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  line_account_id   uuid references public.line_official_accounts (id) on delete set null,
  name              text not null,
  status            public.delivery_status not null default 'draft',
  target_type       public.delivery_target not null default 'all',
  filter            jsonb not null default '{}'::jsonb,
  target_count      integer not null default 0,
  max_count         integer,
  target_updated_at timestamptz,
  scheduled_at      timestamptz,
  repeat_daily      boolean not null default false,
  created_at        timestamptz not null default now()
);

create index on public.message_deliveries (company_id, status);

create table public.message_delivery_contents (
  id            uuid primary key default gen_random_uuid(),
  delivery_id   uuid not null references public.message_deliveries (id) on delete cascade,
  kind          public.delivery_content_kind not null default 'text',
  body          text,
  image_url     text,
  link_url      text,
  notify_text   text,
  display_order integer not null default 0
);

create table public.message_delivery_jobs (
  id           uuid primary key default gen_random_uuid(),
  delivery_id  uuid not null references public.message_deliveries (id) on delete cascade,
  sent_at      timestamptz not null default now(),
  sent_count   integer not null default 0,
  opened_count integer not null default 0
);

create table public.mini_games (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  name           text not null,
  enabled        boolean not null default false,
  shop_ids       uuid[] not null default '{}',
  time_from_min  integer,
  time_to_min    integer,
  image_url      text,
  win_rate       numeric(5, 4) not null default 0.1,
  win_coupon_id  uuid references public.coupons (id) on delete set null,
  lose_coupon_id uuid references public.coupons (id) on delete set null
);

create table public.membership_card_configs (
  company_id uuid primary key references public.companies (id) on delete cascade,
  design     text not null default 'standard'
);

create table public.membership_ranks (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null,
  min_visits    integer not null default 1,
  coupon_id     uuid references public.coupons (id) on delete set null,
  display_order integer not null default 0
);

create table public.questionnaires (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  kind             public.questionnaire_kind not null default 'mobile_order',
  name             text not null,
  image_url        text,
  reward_coupon_id uuid references public.coupons (id) on delete set null
);

create table public.questionnaire_answers (
  id                uuid primary key default gen_random_uuid(),
  questionnaire_id  uuid references public.questionnaires (id) on delete set null,
  customer_id       uuid references public.customers (id) on delete set null,
  shop_id           uuid not null references public.shops (id) on delete cascade,
  table_session_id  uuid references public.table_sessions (id) on delete set null,
  answered_at       timestamptz not null default now(),
  revisit_score     integer,
  service_score     integer,
  food_score        integer,
  speed_score       integer,
  clean_score       integer,
  comment           text,
  gender            public.customer_gender not null default 'unknown',
  age               integer,
  awareness_channel text
);

create index on public.questionnaire_answers (shop_id, answered_at desc);

create table public.menu_reviews (
  id          uuid primary key default gen_random_uuid(),
  menu_id     uuid not null references public.menus (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  shop_id     uuid not null references public.shops (id) on delete cascade,
  score       integer not null,
  tags        text[] not null default '{}',
  comment     text,
  reviewed_at timestamptz not null default now()
);

create index on public.menu_reviews (menu_id);

create table public.employee_reviews (
  id          uuid primary key default gen_random_uuid(),
  clerk_id    uuid not null references public.clerks (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  shop_id     uuid not null references public.shops (id) on delete cascade,
  is_good     boolean not null,
  comment     text,
  reviewed_at timestamptz not null default now()
);

create index on public.employee_reviews (clerk_id);

create table public.shop_questionnaire_settings (
  shop_id              uuid primary key references public.shops (id) on delete cascade,
  menu_review_enabled  boolean not null default false,
  staff_review_enabled boolean not null default false
);

-- RLS
alter table public.customers                   enable row level security;
alter table public.customer_visits             enable row level security;
alter table public.line_official_accounts      enable row level security;
alter table public.coupons                     enable row level security;
alter table public.customer_coupons            enable row level security;
alter table public.coupon_presets              enable row level security;
alter table public.message_deliveries          enable row level security;
alter table public.message_delivery_contents   enable row level security;
alter table public.message_delivery_jobs       enable row level security;
alter table public.mini_games                  enable row level security;
alter table public.membership_card_configs     enable row level security;
alter table public.membership_ranks            enable row level security;
alter table public.questionnaires              enable row level security;
alter table public.questionnaire_answers       enable row level security;
alter table public.menu_reviews                enable row level security;
alter table public.employee_reviews            enable row level security;
alter table public.shop_questionnaire_settings enable row level security;

revoke all on table
  public.customers, public.customer_visits, public.line_official_accounts,
  public.coupons, public.customer_coupons, public.coupon_presets,
  public.message_deliveries, public.message_delivery_contents,
  public.message_delivery_jobs, public.mini_games,
  public.membership_card_configs, public.membership_ranks,
  public.questionnaires, public.questionnaire_answers,
  public.menu_reviews, public.employee_reviews,
  public.shop_questionnaire_settings
from anon, authenticated;
