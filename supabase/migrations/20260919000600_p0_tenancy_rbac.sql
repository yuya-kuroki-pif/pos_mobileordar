-- ===========================================================================
-- P0 基盤: マルチテナント構造と RBAC
-- 仕様書 §1.3 / §8.1 / §8.8 に対応
--
--   法人 (corporations)
--    └─ 業態 (companies)
--        └─ 店舗 (shops)   ※ これまでの stores を改名して組み込む
--
-- メニューマスターを業態単位へ移す作業（§8.2）は P1 で行う。
-- ここでは組織・アカウント・権限だけを整える。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 法人・業態
-- ---------------------------------------------------------------------------
create table public.corporations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.corporations is '法人。テナントの最上位。RLS の基準になる';

create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  corporation_id  uuid not null references public.corporations (id) on delete cascade,
  name            text not null,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on public.companies (corporation_id, display_order);
comment on table public.companies is '業態（ブランド）。メニューマスターはこの単位で持つ';

-- ---------------------------------------------------------------------------
-- 店舗: stores を shops へ改名し、業態にぶら下げる
--
-- 仕様書 §8.1 の shops は 40 以上の設定列を持つが、それらは店舗編集画面
-- （P1）と同時に追加する。ここでは組織構造と一覧表示に要る分だけ足す。
-- ---------------------------------------------------------------------------
alter table public.stores rename to shops;

alter table public.shops
  add column company_id    uuid references public.companies (id) on delete restrict,
  add column name_en       text,
  add column icon_url      text,
  add column open_time     time,
  add column close_time    time,
  add column display_order integer not null default 0;

-- 既存データ（デモ店舗）を法人・業態の下へ移す
do $$
declare
  v_corp uuid;
  v_company uuid;
begin
  if exists (select 1 from public.shops) then
    insert into public.corporations (name) values ('デモ法人') returning id into v_corp;
    insert into public.companies (corporation_id, name, display_order)
      values (v_corp, 'デモ業態', 10) returning id into v_company;
    update public.shops set company_id = v_company where company_id is null;
  end if;
end $$;

alter table public.shops alter column company_id set not null;
create index on public.shops (company_id, display_order);

-- ---------------------------------------------------------------------------
-- 店舗グループ（分析で店舗をまとめて扱うための任意グループ）
-- ---------------------------------------------------------------------------
create table public.shop_groups (
  id              uuid primary key default gen_random_uuid(),
  corporation_id  uuid not null references public.corporations (id) on delete cascade,
  name            text not null,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now()
);

create table public.shop_group_members (
  group_id  uuid not null references public.shop_groups (id) on delete cascade,
  shop_id   uuid not null references public.shops (id) on delete cascade,
  primary key (group_id, shop_id)
);

-- ---------------------------------------------------------------------------
-- アカウント・権限（§8.8 / §10.2）
-- ---------------------------------------------------------------------------
create type public.account_status as enum ('active', 'invited', 'disabled');
create type public.rbac_product   as enum ('pos', 'es');
create type public.rbac_scope     as enum ('corporation', 'company', 'shop');

create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  corporation_id  uuid not null references public.corporations (id) on delete cascade,
  email           text not null,
  name            text not null,
  status          public.account_status not null default 'invited',
  -- 仕様書 §10.1 は Supabase Auth を前提にしている。
  -- 招待メールの導線が整うまでの暫定として、ここでパスワードを保持する
  -- （bcrypt。auth.users へ移行したら auth_uid 側へ寄せて削除する）
  password_hash   text,
  auth_uid        uuid,
  joined_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index accounts_email_per_corporation
  on public.accounts (corporation_id, lower(email));

create table public.roles_definitions (
  id              uuid primary key default gen_random_uuid(),
  corporation_id  uuid not null references public.corporations (id) on delete cascade,
  product         public.rbac_product not null default 'pos',
  name            text not null,
  -- 既定ロール（法人管理者 / 業態管理者 / 店舗管理者）は削除・改名させない
  is_system       boolean not null default false,
  -- { 機能キー: 'edit' | 'view' | 'none' }
  permissions     jsonb not null default '{}'::jsonb,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on public.roles_definitions (corporation_id, product, display_order);

create table public.account_roles (
  account_id  uuid not null references public.accounts (id) on delete cascade,
  product     public.rbac_product not null default 'pos',
  role_id     uuid not null references public.roles_definitions (id) on delete restrict,
  scope_type  public.rbac_scope not null default 'corporation',
  -- scope_type が company / shop のときに対象 ID を並べる
  scope_ids   uuid[] not null default '{}',
  primary key (account_id, product)
);

create table public.account_audit_logs (
  id              uuid primary key default gen_random_uuid(),
  corporation_id  uuid not null references public.corporations (id) on delete cascade,
  account_id      uuid references public.accounts (id) on delete set null,
  action          text not null,
  target          text,
  ip              text,
  occurred_at     timestamptz not null default now()
);

create index on public.account_audit_logs (corporation_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 既定ロール（§10.2 の実機の値をそのまま採用）
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_roles(p_corporation_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.roles_definitions (corporation_id, product, name, is_system, permissions, display_order)
  values
    (p_corporation_id, 'pos', '法人管理者', true, jsonb_build_object(
      'account_management','edit', 'bi_integration','edit', 'menu_master','edit',
      'company_management','edit', 'crm','edit', 'analytics','edit',
      'target_management','edit', 'vendor_registration','edit', 'purchase_list','edit',
      'petty_cash','edit', 'shop_management','edit', 'questionnaire_analytics','edit',
      'daily_closing','edit', 'accounting_history','edit', 'table_usage_history','edit',
      'payment_settings','edit', 'cashless','edit', 'recommendation_menu','edit',
      'monthly_pl_report','edit', 'pl_accounts','edit', 'income_expense','edit',
      'cost_display','view', 'labor_cost_parttime_display','view',
      'labor_cost_employee_display','view', 'audit_logs','view',
      'account_audit_logs','none'
    ), 10),
    (p_corporation_id, 'pos', '業態管理者', true, jsonb_build_object(
      'account_management','view', 'bi_integration','view', 'menu_master','edit',
      'company_management','edit', 'crm','edit', 'analytics','edit',
      'target_management','edit', 'vendor_registration','view', 'purchase_list','edit',
      'petty_cash','edit', 'shop_management','edit', 'questionnaire_analytics','edit',
      'daily_closing','edit', 'accounting_history','edit', 'table_usage_history','edit',
      'payment_settings','edit', 'cashless','none', 'recommendation_menu','edit',
      'monthly_pl_report','view', 'pl_accounts','view', 'income_expense','view',
      'cost_display','view', 'labor_cost_parttime_display','view',
      'labor_cost_employee_display','none', 'audit_logs','view',
      'account_audit_logs','none'
    ), 20),
    (p_corporation_id, 'pos', '店舗管理者', true, jsonb_build_object(
      'account_management','view', 'bi_integration','view', 'menu_master','view',
      'company_management','none', 'crm','none', 'analytics','view',
      'target_management','view', 'vendor_registration','none', 'purchase_list','edit',
      'petty_cash','edit', 'shop_management','edit', 'questionnaire_analytics','view',
      'daily_closing','view', 'accounting_history','view', 'table_usage_history','none',
      'payment_settings','none', 'cashless','none', 'recommendation_menu','view',
      'monthly_pl_report','view', 'pl_accounts','none', 'income_expense','view',
      'cost_display','view', 'labor_cost_parttime_display','none',
      'labor_cost_employee_display','view', 'audit_logs','view',
      'account_audit_logs','none'
    ), 30);
end;
$$;

-- 既存の法人に既定ロールを入れておく
do $$
declare v_corp uuid;
begin
  for v_corp in select id from public.corporations loop
    perform public.seed_default_roles(v_corp);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- ログイン照合（暫定。Supabase Auth へ移行したら不要になる）
-- ---------------------------------------------------------------------------
create or replace function public.verify_account_password(
  p_email    text,
  p_password text
)
returns uuid
language sql
stable
as $$
  select id
  from public.accounts
  where lower(email) = lower(p_email)
    and status = 'active'
    and password_hash is not null
    and password_hash = crypt(p_password, password_hash);
$$;

create or replace function public.set_account_password(
  p_account_id uuid,
  p_password   text
)
returns void
language sql
as $$
  update public.accounts
  set password_hash = crypt(p_password, gen_salt('bf')),
      status = case when status = 'invited' then 'active'::public.account_status else status end,
      joined_at = coalesce(joined_at, now())
  where id = p_account_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS。既存テーブルと同じく全拒否し、アクセスはサーバー経由に限る
-- ---------------------------------------------------------------------------
alter table public.corporations       enable row level security;
alter table public.companies          enable row level security;
alter table public.shop_groups        enable row level security;
alter table public.shop_group_members enable row level security;
alter table public.accounts           enable row level security;
alter table public.roles_definitions  enable row level security;
alter table public.account_roles      enable row level security;
alter table public.account_audit_logs enable row level security;

revoke all on table
  public.corporations, public.companies, public.shop_groups, public.shop_group_members,
  public.accounts, public.roles_definitions, public.account_roles, public.account_audit_logs
from anon, authenticated;

revoke all on function public.verify_account_password(text, text) from anon, authenticated;
revoke all on function public.set_account_password(uuid, text)    from anon, authenticated;
revoke all on function public.seed_default_roles(uuid)            from anon, authenticated;
