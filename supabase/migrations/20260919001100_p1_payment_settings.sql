-- ===========================================================================
-- P1: 支払方法等設定（仕様書 §5.10）
--
-- 支払方法・割引方法・媒体・キャッシュレス端末の対応づけを、業態単位の
-- マスターとして持つ。メニューマスターと同じく 業態（companies）にぶら下げる。
--
-- 既存の payments.method（enum）は当面そのまま。レジ側をこのマスターへ
-- つなぎ替えるのは、会計まわりを触るときにまとめて行う。
-- ===========================================================================

-- 支払種別（§5.10 の 8 種）
create type public.payment_kind as enum (
  'cash',              -- 現金
  'mobile',            -- モバイル決済
  'credit',            -- クレジット
  'point',             -- ポイント
  'qr',                -- QR決済
  'e_money',           -- 電子マネー
  'credit_sale',       -- 掛売
  'gift_certificate'   -- 商品券
);

-- 支払方法
create table public.payment_methods (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null,
  kind          public.payment_kind not null,
  -- 「現金」「オンライン決済」はシステム既定。削除できない
  is_system     boolean not null default false,
  display_order integer not null default 0
);

create index on public.payment_methods (company_id, display_order);

-- 割引方法（例: 端数値引、スタッフ割引15％、値引き券）
create table public.discount_types (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null,
  -- 「端数値引」は既定
  is_system     boolean not null default false,
  display_order integer not null default 0
);

create index on public.discount_types (company_id, display_order);

-- 媒体（流入媒体）
create table public.inflow_sources (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  name          text not null,
  -- 「フリー」は既定
  is_system     boolean not null default false,
  display_order integer not null default 0
);

create index on public.inflow_sources (company_id, display_order);

-- キャッシュレス端末支払方法。決済端末が返すブランド名を支払方法へ対応づける
create table public.terminal_payment_methods (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  brand             text not null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  display_order     integer not null default 0,
  unique (company_id, brand)
);

create index on public.terminal_payment_methods (company_id, display_order);

-- ---------------------------------------------------------------------------
-- 業態を作ったときに入れる既定値（§5.10）
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_payment_settings(p_company_id uuid)
returns void
language sql
as $$
  insert into public.payment_methods (company_id, name, kind, is_system, display_order)
  values
    (p_company_id, '現金',           'cash',    true,  10),
    (p_company_id, 'オンライン決済', 'mobile',  true,  20),
    (p_company_id, 'クレジットカード', 'credit', false, 30),
    (p_company_id, 'QR決済',         'qr',      false, 40),
    (p_company_id, '電子マネー',     'e_money', false, 50)
  on conflict do nothing;

  insert into public.discount_types (company_id, name, is_system, display_order)
  values (p_company_id, '端数値引', true, 10)
  on conflict do nothing;

  insert into public.inflow_sources (company_id, name, is_system, display_order)
  values
    (p_company_id, 'フリー',         true,  10),
    (p_company_id, 'ホットペッパー', false, 20),
    (p_company_id, '食べログ',       false, 30),
    (p_company_id, '公式HP',         false, 40),
    (p_company_id, 'ぐるなび',       false, 50)
  on conflict do nothing;
$$;

-- 既存の業態にも入れておく
do $$
declare
  v_company uuid;
begin
  for v_company in select id from public.companies loop
    perform public.seed_default_payment_settings(v_company);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS。他と同じく全拒否で、アクセスはサーバー経由のみ
-- ---------------------------------------------------------------------------
alter table public.payment_methods          enable row level security;
alter table public.discount_types           enable row level security;
alter table public.inflow_sources           enable row level security;
alter table public.terminal_payment_methods enable row level security;

revoke all on table
  public.payment_methods, public.discount_types,
  public.inflow_sources, public.terminal_payment_methods
from anon, authenticated;

revoke all on function public.seed_default_payment_settings(uuid) from anon, authenticated;
