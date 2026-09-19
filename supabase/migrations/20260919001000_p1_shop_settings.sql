-- ===========================================================================
-- P1: 店舗編集（仕様書 §5.12 / §8.1）
--
-- §8.1 の shops は 40 以上の設定列を持つ。P0 では組織構造に要る分だけ足して
-- あったので、ここで店舗編集画面の 4 タブぶんをまとめて追加する。
-- ===========================================================================

-- 会計ボタン押下後にお客様へ出す案内
create type public.checkout_guide as enum ('wait_at_table', 'call_staff', 'come_to_register');

-- 釣銭準備金を入力するタイミング
create type public.change_fund_timing as enum ('with_closing', 'separate');

-- ---------------------------------------------------------------------------
-- 開店・閉店時刻を「0:00 からの分」に置き換える
--
-- 仕様書は閉店 24:00〜 を許容し 31:00（＝翌 7:00）の形で表示する。
-- Postgres の time は 24:00:00 までしか持てないため、分単位の整数にする。
-- ---------------------------------------------------------------------------
alter table public.shops
  add column open_time_min  integer check (open_time_min between 0 and 1860),
  add column close_time_min integer check (close_time_min between 0 and 1860);

update public.shops
set open_time_min = extract(hour from open_time) * 60 + extract(minute from open_time)
where open_time is not null;

update public.shops
set close_time_min = extract(hour from close_time) * 60 + extract(minute from close_time)
where close_time is not null;

alter table public.shops drop column open_time, drop column close_time;

comment on column public.shops.close_time_min is
  '0:00 からの分。1440 以上は翌日を指す（1860 なら 31:00 ＝ 翌 7:00）';

-- ---------------------------------------------------------------------------
-- 店舗タブ（§5.12）
-- ---------------------------------------------------------------------------
alter table public.shops
  add column last_order_label         text,
  add column checkout_note            text,
  -- 1 回の注文で 1 人あたり何点まで頼めるか
  add column order_limit_enabled      boolean not null default false,
  add column order_limit_per_person   integer,
  add column sold_out_daily_reset     boolean not null default true,
  add column note_input_enabled       boolean not null default true,
  add column staff_call_enabled       boolean not null default true,
  -- 自動会計伝票（キッチンプリンターにのみ出せる）
  add column auto_checkout_slip       boolean not null default false,
  add column show_tax_excluded_price  boolean not null default false,
  add column checkout_guide           public.checkout_guide not null default 'wait_at_table',
  -- レジ・ハンディのアラート
  add column entry_alert_enabled      boolean not null default false,
  add column entry_alert_min          integer,
  add column last_order_alert_enabled boolean not null default false,
  add column last_order_alert_min     integer,
  add column tip_enabled              boolean not null default false,
  -- AI 機能のトグル
  add column ai_handy                 boolean not null default false,
  add column ai_chat_diagnosis        boolean not null default false,
  add column ai_menu_book_diagnosis   boolean not null default false,
  add column ai_mo_optimize           boolean not null default false,
  add column ai_daily_report          boolean not null default false,
  add column ai_sales_forecast        boolean not null default false,
  add column ai_slip_instruction      boolean not null default false;

-- ---------------------------------------------------------------------------
-- レジ設定タブ（§5.12）
-- ---------------------------------------------------------------------------
alter table public.shops
  add column receipt_address          text,
  add column contact_info             text,
  -- 収入印紙の貼付省略に使う税務署名
  add column stamp_tax_office         text,
  add column select_staff_on_checkout boolean not null default false,
  add column change_fund_timing       public.change_fund_timing not null default 'with_closing',
  add column default_inflow_free      boolean not null default false,
  -- 0 円のメニュー・オプション・選択肢をレシートに載せるか
  add column show_zero_price_items    boolean not null default true,
  add column auto_round_discount      boolean not null default false,
  add column open_drawer_on_cashless  boolean not null default false,
  -- 操作用パスワード。画面からは設定のみで、読み出しはしない
  add column drawer_open_password_hash text,
  add column void_password_hash        text,
  add column table_clear_password_hash text,
  add column use_stera                boolean not null default false,
  add column receipt_auto_print       boolean not null default true,
  add column temp_receipt_enabled     boolean not null default false,
  -- 点検・精算伝票に載せる売上詳細
  add column closing_by_time_slot     boolean not null default true,
  add column closing_by_location      boolean not null default true,
  add column closing_by_area          boolean not null default false,
  add column closing_by_menu_type     boolean not null default false,
  add column closing_by_inflow        boolean not null default false,
  -- 点検・精算伝票の税表示。true なら税込
  add column closing_tax_included     boolean not null default true,
  -- 割増設定
  add column time_charge_rate         numeric(5, 4) not null default 0.0000,
  add column time_charge_start_min    integer check (time_charge_start_min between 0 and 1680),
  add column time_charge_end_min      integer check (time_charge_end_min between 0 and 1680);

-- ---------------------------------------------------------------------------
-- Google マップ設定タブ（§5.12）
-- ---------------------------------------------------------------------------
alter table public.shops
  add column google_place_id         text,
  add column gmap_review_from_survey boolean not null default false,
  add column gmap_review_promote_mo  boolean not null default false,
  -- 最初の注文から何分経ったら口コミを促すか
  add column gmap_review_min_minutes integer;

-- ---------------------------------------------------------------------------
-- 営業時間帯タブ（§5.12）。分析画面の「営業時間帯」フィルターに使う
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  name          text not null,
  start_min     integer not null check (start_min between 0 and 1860),
  end_min       integer not null check (end_min between 0 and 1860),
  display_order integer not null default 0
);

create index on public.business_hours (shop_id, display_order);

-- ---------------------------------------------------------------------------
-- 操作用パスワードの設定。ハッシュだけを持ち、読み出す口は作らない
-- ---------------------------------------------------------------------------
create or replace function public.set_shop_password(
  p_shop_id  uuid,
  p_kind     text,
  p_password text
)
returns void
language plpgsql
as $$
declare
  v_hash text;
begin
  if p_kind not in ('drawer_open', 'void', 'table_clear') then
    raise exception 'パスワードの種類が不正です: %', p_kind;
  end if;

  if p_password is null then
    v_hash := null;
  elsif length(p_password) < 4 then
    raise exception 'パスワードは 4 文字以上にしてください';
  else
    v_hash := crypt(p_password, gen_salt('bf'));
  end if;

  update public.shops
  set drawer_open_password_hash =
        case when p_kind = 'drawer_open' then v_hash else drawer_open_password_hash end,
      void_password_hash =
        case when p_kind = 'void' then v_hash else void_password_hash end,
      table_clear_password_hash =
        case when p_kind = 'table_clear' then v_hash else table_clear_password_hash end
  where id = p_shop_id;

  if not found then
    raise exception '店舗が見つかりません';
  end if;
end;
$$;

alter table public.business_hours enable row level security;
revoke all on table public.business_hours from anon, authenticated;
revoke all on function public.set_shop_password(uuid, text, text) from anon, authenticated;
