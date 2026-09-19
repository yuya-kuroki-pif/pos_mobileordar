-- ===========================================================================
-- フェーズ A: 業務ロジック
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 会計金額の計算（税率別の内訳つき）
--
-- 計算順序:
--   1. 税率ごとに明細を合算する
--   2. サービス料を標準税率のグループに加える
--   3. 割引を各グループへ金額按分する（端数は最後のグループが負担）
--   4. グループごとに消費税を計算する
--
-- 内税の場合、税額は総額からの逆算（表示用の内訳）になる。
-- 税率ごとに分けて計算しないとインボイスの記載要件を満たせないため、
-- 合計から一括で逆算する形にはしていない。
-- ---------------------------------------------------------------------------
drop function if exists public.calc_session_total(uuid, integer);

create or replace function public.calc_session_total(
  p_session_id  uuid,
  p_discount    integer default 0,
  -- 分割会計では未会計の明細だけを対象にする
  p_only_unpaid boolean default true,
  -- 明細を指定した分割会計。null なら対象を絞らない
  p_item_ids    uuid[] default null
)
returns table (
  subtotal       integer,
  service_charge integer,
  discount       integer,
  tax            integer,
  total          integer,
  tax_breakdown  jsonb
)
language plpgsql
stable
as $$
declare
  v_store public.stores%rowtype;
begin
  select s.* into v_store
  from public.stores s
  join public.table_sessions ts on ts.store_id = s.id
  where ts.id = p_session_id;

  if not found then
    raise exception 'session % not found', p_session_id using errcode = 'no_data_found';
  end if;

  return query
  with target as (
    select oi.tax_rate as rate, oi.line_total
    from public.order_items oi
    where oi.session_id = p_session_id
      and oi.status <> 'cancelled'
      and (not p_only_unpaid or oi.payment_id is null)
      and (p_item_ids is null or oi.id = any (p_item_ids))
  ),
  grouped as (
    select t.rate, sum(t.line_total)::integer as amount
    from target t
    group by t.rate
  ),
  sub as (
    select coalesce(sum(g.amount), 0)::integer as v from grouped g
  ),
  charge as (
    select round((select x.v from sub x) * v_store.service_charge_rate)::integer as v
  ),
  -- サービス料の受け皿として標準税率のグループを必ず用意する
  with_charge as (
    select g.rate, g.amount from grouped g
    union all
    select v_store.standard_tax_rate, 0
    where (select x.v from charge x) > 0
      and not exists (select 1 from grouped g2 where g2.rate = v_store.standard_tax_rate)
  ),
  charged as (
    select w.rate,
           w.amount + case when w.rate = v_store.standard_tax_rate
                           then (select x.v from charge x)
                           else 0 end as amount
    from with_charge w
  ),
  gross as (
    select coalesce(sum(c.amount), 0)::integer as v from charged c
  ),
  disc as (
    select least(greatest(p_discount, 0), (select x.v from gross x))::integer as v
  ),
  -- 割引を金額按分する。切り捨てで配り、余りは最後のグループに寄せる
  shared as (
    select c.rate,
           c.amount,
           case when (select x.v from gross x) = 0 then 0
                else floor(
                  (select x.v from disc x)::numeric * c.amount / (select x.v from gross x)
                )::integer
           end as share,
           row_number() over (order by c.rate) as rn,
           count(*) over () as cnt
    from charged c
  ),
  settled as (
    select sh.rate,
           greatest(
             sh.amount - (
               sh.share + case when sh.rn = sh.cnt
                               then (select x.v from disc x) - sum(sh.share) over ()
                               else 0 end
             ),
             0
           )::integer as base
    from shared sh
  ),
  taxed as (
    select st.rate,
           st.base,
           case when v_store.tax_included
                then round(st.base * st.rate / (1 + st.rate))::integer
                else round(st.base * st.rate)::integer
           end as tax
    from settled st
  )
  select
    (select x.v from sub x),
    (select x.v from charge x),
    (select x.v from disc x),
    coalesce((select sum(t.tax) from taxed t), 0)::integer,
    case when v_store.tax_included
         then coalesce((select sum(t.base) from taxed t), 0)::integer
         else coalesce((select sum(t.base + t.tax) from taxed t), 0)::integer
    end,
    coalesce(
      (select jsonb_agg(
                jsonb_build_object('rate', t.rate, 'taxable', t.base, 'tax', t.tax)
                order by t.rate desc)
       from taxed t
       where t.base > 0),
      '[]'::jsonb
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 注文を確定する（提供形態と税率の判定を追加）
-- ---------------------------------------------------------------------------
drop function if exists public.place_order(uuid, public.order_channel, jsonb, text);

create or replace function public.place_order(
  p_session_id   uuid,
  p_channel      public.order_channel,
  p_items        jsonb,
  p_note         text default null,
  -- null ならセッションの提供形態を引き継ぐ
  p_service_type public.service_type default null
)
returns uuid
language plpgsql
as $$
declare
  v_session       public.table_sessions%rowtype;
  v_store         public.stores%rowtype;
  v_service_type  public.service_type;
  v_order_id      uuid;
  v_order_number  integer;
  v_item          jsonb;
  v_menu          public.menu_items%rowtype;
  v_quantity      integer;
  v_option_ids    uuid[];
  v_options_price integer;
  v_options_snap  jsonb;
  v_tax_rate      numeric(5, 4);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception '注文内容が空です' using errcode = 'check_violation';
  end if;

  select * into v_session from public.table_sessions where id = p_session_id;
  if not found then
    raise exception 'session % not found', p_session_id using errcode = 'no_data_found';
  end if;
  if v_session.status not in ('open', 'bill_requested') then
    raise exception 'この卓はすでに会計済みです' using errcode = 'check_violation';
  end if;

  select * into v_store from public.stores where id = v_session.store_id;
  v_service_type := coalesce(p_service_type, v_session.service_type);

  perform pg_advisory_xact_lock(hashtext(v_session.store_id::text));

  select coalesce(max(o.order_number), 0) + 1 into v_order_number
  from public.orders o
  where o.store_id = v_session.store_id
    and public.business_date(o.placed_at, v_store.timezone, v_store.business_day_cutoff_hour)
        = public.business_date(now(), v_store.timezone, v_store.business_day_cutoff_hour);

  insert into public.orders (store_id, session_id, order_number, channel, note, service_type)
  values (v_session.store_id, p_session_id, v_order_number, p_channel, p_note, v_service_type)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_menu
    from public.menu_items
    where id = (v_item ->> 'menu_item_id')::uuid
      and store_id = v_session.store_id;

    if not found then
      raise exception '商品が見つかりません: %', v_item ->> 'menu_item_id'
        using errcode = 'no_data_found';
    end if;
    if not v_menu.is_available or v_menu.is_sold_out then
      raise exception '「%」は現在ご注文いただけません', v_menu.name
        using errcode = 'check_violation';
    end if;

    -- 持ち帰りの飲食料品だけが軽減税率。酒類・非飲食料品は標準税率のまま
    v_tax_rate := case
      when v_service_type = 'takeout' and v_menu.reduced_rate_eligible
      then v_store.reduced_tax_rate
      else v_store.standard_tax_rate
    end;

    v_quantity := greatest(coalesce((v_item ->> 'quantity')::integer, 1), 1);

    select coalesce(array_agg((value #>> '{}')::uuid), '{}')
      into v_option_ids
    from jsonb_array_elements(coalesce(v_item -> 'option_ids', '[]'::jsonb));

    select
      coalesce(sum(o.price_delta), 0),
      coalesce(
        jsonb_agg(jsonb_build_object(
          'group', g.name, 'name', o.name, 'price_delta', o.price_delta
        ) order by g.sort_order, o.sort_order),
        '[]'::jsonb
      )
    into v_options_price, v_options_snap
    from public.options o
    join public.option_groups g on g.id = o.group_id
    where o.id = any (v_option_ids)
      and o.is_available
      and g.store_id = v_session.store_id;

    insert into public.order_items (
      store_id, order_id, session_id, menu_item_id,
      name_snapshot, unit_price, options_price, options_snapshot,
      quantity, tax_rate, prep_station, note
    )
    values (
      v_session.store_id, v_order_id, p_session_id, v_menu.id,
      v_menu.name, v_menu.price, v_options_price, v_options_snap,
      v_quantity, v_tax_rate, v_menu.prep_station,
      nullif(v_item ->> 'note', '')
    );
  end loop;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 会計する（全額 / 明細指定 / 人数割り）
--
--   p_item_ids を指定  → その明細だけを会計する（明細指定の分割）
--   p_split_count > 1  → 未会計分を等分する（人数割り）。端数は 1 人目が負担
--   どちらも指定なし   → 未会計分をすべて会計する
--
-- 未会計の明細が残っている間、セッションは開いたままにする。
-- ---------------------------------------------------------------------------
drop function if exists public.checkout_session(uuid, public.payment_method, integer, integer, text);

create or replace function public.checkout_payment(
  p_session_id  uuid,
  p_method      public.payment_method,
  p_discount    integer default 0,
  p_received    integer default 0,
  p_note        text default null,
  p_item_ids    uuid[] default null,
  p_split_count integer default 1,
  p_split_index integer default 1
)
returns uuid
language plpgsql
as $$
declare
  v_session    public.table_sessions%rowtype;
  v_calc       record;
  v_payment_id uuid;
  v_change     integer;
  v_amount     integer;
  v_ratio      numeric;
  v_breakdown  jsonb;
  v_is_last    boolean;
  v_remaining  integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  select * into v_session from public.table_sessions where id = p_session_id;
  if not found then
    raise exception 'session % not found', p_session_id using errcode = 'no_data_found';
  end if;
  if v_session.status in ('closed', 'cancelled', 'merged') then
    raise exception 'この卓はすでに会計済みです' using errcode = 'check_violation';
  end if;
  if p_split_count > 1 and p_item_ids is not null then
    raise exception '明細指定と人数割りは同時に使えません' using errcode = 'check_violation';
  end if;
  if p_split_index > p_split_count then
    raise exception '分割の指定が不正です' using errcode = 'check_violation';
  end if;

  select * into v_calc
  from public.calc_session_total(p_session_id, p_discount, true, p_item_ids);

  if v_calc.total = 0 and v_calc.subtotal = 0 then
    raise exception '会計対象の明細がありません' using errcode = 'check_violation';
  end if;

  v_is_last := p_split_index >= p_split_count;

  if p_split_count > 1 then
    -- 等分する。割り切れない端数は 1 人目が多く負担する
    v_amount := v_calc.total / p_split_count;
    if p_split_index = 1 then
      v_amount := v_amount + (v_calc.total - v_amount * p_split_count);
    end if;
    v_ratio := case when v_calc.total = 0 then 0 else v_amount::numeric / v_calc.total end;
  else
    v_amount := v_calc.total;
    v_ratio := 1;
  end if;

  -- 税率別内訳も同じ比率で按分する
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'rate', (e ->> 'rate')::numeric,
             'taxable', round((e ->> 'taxable')::numeric * v_ratio)::integer,
             'tax', round((e ->> 'tax')::numeric * v_ratio)::integer
           )),
           '[]'::jsonb)
    into v_breakdown
  from jsonb_array_elements(v_calc.tax_breakdown) e;

  if p_method = 'cash' then
    if p_received < v_amount then
      raise exception '預かり金が不足しています（合計 %円 / 預かり %円）', v_amount, p_received
        using errcode = 'check_violation';
    end if;
    v_change := p_received - v_amount;
  else
    v_change := 0;
  end if;

  insert into public.payments (
    store_id, session_id, method,
    subtotal, discount, service_charge, tax, total,
    received, change_due, note, tax_breakdown, split_count, split_index
  )
  values (
    v_session.store_id, p_session_id, p_method,
    round(v_calc.subtotal * v_ratio)::integer,
    round(v_calc.discount * v_ratio)::integer,
    round(v_calc.service_charge * v_ratio)::integer,
    round(v_calc.tax * v_ratio)::integer,
    v_amount,
    case when p_method = 'cash' then p_received else v_amount end,
    v_change, p_note, v_breakdown, p_split_count, p_split_index
  )
  returning id into v_payment_id;

  -- 明細への紐付け。人数割りでは最後の 1 回でまとめて紐付ける
  if p_item_ids is not null then
    update public.order_items
    set payment_id = v_payment_id
    where session_id = p_session_id
      and payment_id is null
      and status <> 'cancelled'
      and id = any (p_item_ids);
  elsif v_is_last then
    update public.order_items
    set payment_id = v_payment_id
    where session_id = p_session_id
      and payment_id is null
      and status <> 'cancelled';
  end if;

  -- 未会計が残っていなければ卓を閉じる
  select count(*) into v_remaining
  from public.order_items
  where session_id = p_session_id
    and payment_id is null
    and status <> 'cancelled';

  if v_remaining = 0 then
    update public.order_items
    set status = 'served'
    where session_id = p_session_id and status in ('pending', 'cooking', 'ready');

    update public.table_sessions
    set status = 'closed', closed_at = now()
    where id = p_session_id;
  end if;

  return v_payment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 会計を取り消す
-- 誤会計のリカバリ。明細の紐付けを外し、卓を開け直す。
-- ---------------------------------------------------------------------------
create or replace function public.void_payment(
  p_payment_id uuid,
  p_reason     text
)
returns void
language plpgsql
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception '会計が見つかりません' using errcode = 'no_data_found';
  end if;
  if v_payment.status = 'refunded' then
    raise exception 'この会計はすでに取り消されています' using errcode = 'check_violation';
  end if;

  -- 記録は消さず、取消として残す（売上集計は status = 'paid' だけを見る）
  update public.payments
  set status = 'refunded', voided_at = now(), void_reason = p_reason
  where id = p_payment_id;

  update public.order_items
  set payment_id = null
  where payment_id = p_payment_id;

  -- 未会計の明細が残ったなら卓を開け直す。
  -- 「他に有効な会計が残っているか」で判定すると、分割会計の一部だけを
  -- 取り消したときに卓が閉じたままになり、残額を再会計できなくなる。
  if exists (
    select 1 from public.order_items
    where session_id = v_payment.session_id
      and payment_id is null
      and status <> 'cancelled'
  ) then
    update public.table_sessions
    set status = 'open', closed_at = null
    where id = v_payment.session_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 卓移動
-- ---------------------------------------------------------------------------
create or replace function public.move_session(
  p_session_id   uuid,
  p_to_table_id  uuid
)
returns void
language plpgsql
as $$
declare
  v_session public.table_sessions%rowtype;
  v_store_id uuid;
begin
  select * into v_session from public.table_sessions where id = p_session_id;
  if not found then
    raise exception '対象の卓が見つかりません' using errcode = 'no_data_found';
  end if;
  if v_session.status not in ('open', 'bill_requested') then
    raise exception '利用中の卓のみ移動できます' using errcode = 'check_violation';
  end if;

  select store_id into v_store_id
  from public.restaurant_tables
  where id = p_to_table_id and is_active;

  if v_store_id is null or v_store_id <> v_session.store_id then
    raise exception '移動先の卓が見つかりません' using errcode = 'no_data_found';
  end if;

  if exists (
    select 1 from public.table_sessions
    where table_id = p_to_table_id and status in ('open', 'bill_requested')
  ) then
    raise exception '移動先の卓は使用中です。先に伝票を結合してください'
      using errcode = 'check_violation';
  end if;

  update public.table_sessions set table_id = p_to_table_id where id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 伝票結合
-- source を target に吸収する。source は 'merged' として残す。
-- ---------------------------------------------------------------------------
create or replace function public.merge_sessions(
  p_source_session_id uuid,
  p_target_session_id uuid
)
returns void
language plpgsql
as $$
declare
  v_source public.table_sessions%rowtype;
  v_target public.table_sessions%rowtype;
begin
  if p_source_session_id = p_target_session_id then
    raise exception '同じ伝票は結合できません' using errcode = 'check_violation';
  end if;

  select * into v_source from public.table_sessions where id = p_source_session_id;
  select * into v_target from public.table_sessions where id = p_target_session_id;

  if v_source.id is null or v_target.id is null then
    raise exception '対象の伝票が見つかりません' using errcode = 'no_data_found';
  end if;
  if v_source.store_id <> v_target.store_id then
    raise exception '別店舗の伝票は結合できません' using errcode = 'check_violation';
  end if;
  if v_source.status not in ('open', 'bill_requested')
     or v_target.status not in ('open', 'bill_requested') then
    raise exception '利用中の伝票のみ結合できます' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.payments where session_id = p_source_session_id and status = 'paid') then
    raise exception '会計済みの伝票は結合できません' using errcode = 'check_violation';
  end if;

  update public.orders      set session_id = p_target_session_id where session_id = p_source_session_id;
  update public.order_items set session_id = p_target_session_id where session_id = p_source_session_id;

  -- 人数は合算する
  update public.table_sessions
  set guest_count = v_target.guest_count + v_source.guest_count
  where id = p_target_session_id;

  update public.table_sessions
  set status = 'merged', closed_at = now()
  where id = p_source_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- レジ締め
-- 理論在高 = 釣銭準備金 + 現金売上 + 入金 - 出金
-- ---------------------------------------------------------------------------
create or replace function public.close_cash_drawer(
  p_store_id      uuid,
  p_business_day  date,
  p_opening_float integer,
  p_counted_cash  integer,
  p_note          text default null
)
returns uuid
language plpgsql
as $$
declare
  v_store       public.stores%rowtype;
  v_cash_sales  integer;
  v_in          integer;
  v_out         integer;
  v_expected    integer;
  v_id          uuid;
begin
  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception '店舗が見つかりません' using errcode = 'no_data_found';
  end if;

  select coalesce(sum(p.total), 0) into v_cash_sales
  from public.payments p
  where p.store_id = p_store_id
    and p.status = 'paid'
    and p.method = 'cash'
    and public.business_date(p.paid_at, v_store.timezone, v_store.business_day_cutoff_hour)
        = p_business_day;

  select
    coalesce(sum(m.amount) filter (where m.kind = 'deposit'), 0),
    coalesce(sum(m.amount) filter (where m.kind = 'withdrawal'), 0)
  into v_in, v_out
  from public.cash_movements m
  where m.store_id = p_store_id and m.business_day = p_business_day;

  v_expected := p_opening_float + v_cash_sales + v_in - v_out;

  insert into public.cash_drawer_closings (
    store_id, business_day, opening_float, cash_sales,
    cash_in, cash_out, expected_cash, counted_cash, difference, note
  )
  values (
    p_store_id, p_business_day, p_opening_float, v_cash_sales,
    v_in, v_out, v_expected, p_counted_cash, p_counted_cash - v_expected, p_note
  )
  on conflict (store_id, business_day) do update set
    opening_float = excluded.opening_float,
    cash_sales    = excluded.cash_sales,
    cash_in       = excluded.cash_in,
    cash_out      = excluded.cash_out,
    expected_cash = excluded.expected_cash,
    counted_cash  = excluded.counted_cash,
    difference    = excluded.difference,
    note          = excluded.note,
    closed_at     = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 権限（他と同じくサーバー経由でのみ呼べるようにする）
-- ---------------------------------------------------------------------------
revoke all on function public.calc_session_total(uuid, integer, boolean, uuid[]) from anon, authenticated;
revoke all on function public.place_order(uuid, public.order_channel, jsonb, text, public.service_type) from anon, authenticated;
revoke all on function public.checkout_payment(uuid, public.payment_method, integer, integer, text, uuid[], integer, integer) from anon, authenticated;
revoke all on function public.void_payment(uuid, text) from anon, authenticated;
revoke all on function public.move_session(uuid, uuid) from anon, authenticated;
revoke all on function public.merge_sessions(uuid, uuid) from anon, authenticated;
revoke all on function public.close_cash_drawer(uuid, date, integer, integer, text) from anon, authenticated;
