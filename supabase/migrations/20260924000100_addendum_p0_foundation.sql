-- ===========================================================================
-- 追補（SPEC_ADDENDUM）§A に合わせた P0 基盤の修正
--
-- 追補 §0.2 に「本書が本編と矛盾する場合は本書を優先」とあるため、
-- すでに作ってある部分のうち食い違うものをここで直す。
-- 追補 §I.5.2 が「後付けが最も高コスト」と挙げている項目を先に入れている。
-- 詳細は docs/spec-addendum-gap.md を参照。
-- ===========================================================================

-- §A.1.3 契約ゲート。権限は「機能キー × 3 値 × 契約」の 3 段で見る
alter table public.corporations
  add column contracts jsonb not null default '{}'::jsonb;

comment on column public.corporations.contracts is
  '契約プランによる機能ゲート。例 {"crm":true,"bi":true,"reservation":false}';

-- §A.5.1 営業日変更時刻。既定 05:00 → 07:00。
-- 時（integer）ではなく time で持つ（24 時間営業店の個別調整のため）
alter table public.shops
  add column business_day_start_time time not null default '07:00';

update public.shops
set business_day_start_time = make_time(business_day_cutoff_hour, 0, 0);

comment on column public.shops.business_day_start_time is
  '営業日変更時刻（追補 §A.5.1。既定 07:00）。編集は運営者権限のみの想定';

-- t < 変更時刻 なら前日扱い
create or replace function public.business_date_at(
  p_at timestamptz,
  p_timezone text,
  p_start_time time
)
returns date
language sql
immutable
as $$
  select case
    when (p_at at time zone p_timezone)::time < p_start_time
      then ((p_at at time zone p_timezone)::date - 1)
    else (p_at at time zone p_timezone)::date
  end;
$$;

comment on function public.business_date_at is
  '営業日変更時刻基準の営業日（追補 §A.5.3 の擬似コード）';

-- §A.5.1 営業時間帯は固定 6 区分。名称変更・追加不可
create type public.business_hour_kind as enum
  ('morning', 'lunch', 'cafe', 'happy_hour', 'dinner', 'late_night');

alter table public.business_hours
  add column kind public.business_hour_kind;

-- 既存行は名前から寄せ、分からないものはディナーに入れる
update public.business_hours
set kind = case
  when name like '%モーニング%' then 'morning'
  when name like '%ランチ%'     then 'lunch'
  when name like '%カフェ%'     then 'cafe'
  when name like '%ハッピー%'   then 'happy_hour'
  when name like '%深夜%'       then 'late_night'
  else 'dinner'
end::public.business_hour_kind;

alter table public.business_hours alter column kind set not null;

create unique index business_hours_one_kind_per_shop
  on public.business_hours (shop_id, kind);

-- §A.6.1 税区分 4 値。不課税は推しエール・チップ専用でメニューには選べない
create type public.tax_type as enum
  ('inclusive', 'exclusive', 'non_taxable', 'out_of_scope');

alter table public.menus
  add column tax_type public.tax_type,
  add column cost_tax_type public.tax_type;

update public.menus
set tax_type = case when tax_method = 'excl' then 'exclusive' else 'inclusive' end::public.tax_type;

alter table public.menus alter column tax_type set not null;

alter table public.menus
  add constraint menus_tax_type_not_out_of_scope
  check (tax_type <> 'out_of_scope');

-- 原価と原価税区分は両方揃っているか、両方空か（§A.6.1）
alter table public.menus
  add constraint menus_cost_pair
  check ((cost_price is null) = (cost_tax_type is null));

-- §A.6.2 明細単位の税。注文時点の値を確定保存し、後のマスター変更に影響されない
alter table public.order_items
  add column tax_type public.tax_type not null default 'inclusive',
  add column unit_tax integer not null default 0,
  add column is_takeout boolean not null default false;

comment on column public.order_items.unit_tax is
  '単価 1 個あたりの税額（切捨て後）。明細税額 = unit_tax * quantity（追補 §A.6.2）';

-- §A.6.3 会計の税率別内訳。伝票と CSV がこの列を見る
alter table public.payments
  add column business_date date,
  add column tax_10_base integer not null default 0,
  add column tax_10_amount integer not null default 0,
  add column tax_8_base integer not null default 0,
  add column tax_8_amount integer not null default 0,
  add column non_taxable_base integer not null default 0,
  add column out_of_scope_base integer not null default 0,
  add column surcharge integer not null default 0,
  add column rounding_discount integer not null default 0,
  add column tip integer not null default 0,
  add column requires_stamp boolean not null default false,
  add column source_mode text not null default 'online';

comment on column public.payments.requires_stamp is
  '収入印紙が要る会計（税込 55,000 円以上かつ現金系。追補 §A.6.3）';

create index on public.payments (store_id, business_date);

-- §0.3-2 計算ロジックのバージョン。
-- 計算式が変わっても、過去の伝票を当時の式で再現できるようにする
alter table public.payments    add column calc_version integer not null default 1;
alter table public.order_items add column calc_version integer not null default 1;

-- §A.5.3 精算単位。開局〜レジ締めを 1 単位として集計する
alter table public.cash_drawer_closings
  add column opened_at timestamptz,
  add column balanced_at timestamptz,
  add column is_training boolean not null default false;

alter table public.payments
  add column balancing_id uuid references public.cash_drawer_closings (id) on delete set null;

comment on column public.payments.balancing_id is
  'この会計が属するレジ精算（追補 §A.5.2。レジ系 CSV はこの単位で集計する）';

create index on public.payments (balancing_id);
