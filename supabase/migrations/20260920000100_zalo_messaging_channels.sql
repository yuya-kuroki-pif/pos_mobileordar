-- ===========================================================================
-- 配信チャネルを LINE 以外にも広げる（Zalo 対応）
--
-- ベトナムでは LINE ではなく Zalo が主流なので、配信アカウントを
-- 「チャネル付きのアカウント」に一般化する。LINE 専用だった
-- line_official_accounts を messaging_accounts へ改名して channel を足す。
-- ===========================================================================

create type public.messaging_channel as enum ('line', 'zalo');

alter table public.line_official_accounts rename to messaging_accounts;

alter table public.messaging_accounts
  add column channel public.messaging_channel not null default 'line',
  add column zns_quota integer not null default 0;

comment on column public.messaging_accounts.channel_id is
  'LINE ならチャネル ID、Zalo なら OA ID';
comment on column public.messaging_accounts.zns_quota is
  'Zalo の ZNS（通知メッセージ）の月間上限。LINE では使わない';

-- 配信そのものにもチャネルを持たせる
alter table public.message_deliveries
  rename column line_account_id to messaging_account_id;

alter table public.message_deliveries
  add column channel public.messaging_channel not null default 'line',
  add column zns_template_id text;

create index on public.message_deliveries (company_id, channel);

-- 顧客側も、どのチャネルの ID かを持てるようにする
alter table public.customers
  add column zalo_user_id text;

comment on column public.customers.line_user_id is 'LINE の userId';
comment on column public.customers.zalo_user_id is 'Zalo の user id';
