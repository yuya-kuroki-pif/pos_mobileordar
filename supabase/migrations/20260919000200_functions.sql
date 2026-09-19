-- ===========================================================================
-- 業務ロジック（RPC 関数）
--
-- 金額計算と伝票番号の採番はすべて DB 側で行う。
-- クライアントから送られてきた価格を信用しないための設計。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 営業日の算出
-- 深夜 2 時の売上を「前日」として集計するため、区切り時刻ぶん巻き戻して日付を取る
-- ---------------------------------------------------------------------------
create or replace function public.business_date(
  p_at       timestamptz,
  p_timezone text,
  p_cutoff   integer
)
returns date
language sql
immutable
as $$
  select ((p_at at time zone p_timezone) - make_interval(hours => p_cutoff))::date;
$$;

-- ---------------------------------------------------------------------------
-- 会計金額の計算
-- 明細合計 → サービス料 → 割引 → 消費税 の順で組み立てる
-- ---------------------------------------------------------------------------
create or replace function public.calc_session_total(
  p_session_id uuid,
  p_discount   integer default 0
)
returns table (
  subtotal       integer,
  service_charge integer,
  discount       integer,
  tax            integer,
  total          integer
)
language plpgsql
stable
as $$
declare
  v_store          public.stores%rowtype;
  v_subtotal       integer;
  v_service_charge integer;
  v_base           integer;
  v_tax            integer;
  v_total          integer;
begin
  select s.* into v_store
  from public.stores s
  join public.table_sessions ts on ts.store_id = s.id
  where ts.id = p_session_id;

  if not found then
    raise exception 'session % not found', p_session_id using errcode = 'no_data_found';
  end if;

  -- キャンセル済みの明細は金額に含めない
  select coalesce(sum(oi.line_total), 0) into v_subtotal
  from public.order_items oi
  where oi.session_id = p_session_id
    and oi.status <> 'cancelled';

  v_service_charge := round(v_subtotal * v_store.service_charge_rate);

  -- 割引は合計を超えないよう丸める
  v_base := greatest(v_subtotal + v_service_charge - greatest(p_discount, 0), 0);

  if v_store.tax_included then
    -- 内税: 総額から消費税分を逆算する（表示用の内訳）
    v_tax   := round(v_base * v_store.tax_rate / (1 + v_store.tax_rate));
    v_total := v_base;
  else
    -- 外税: 総額に上乗せする
    v_tax   := round(v_base * v_store.tax_rate);
    v_total := v_base + v_tax;
  end if;

  return query select
    v_subtotal,
    v_service_charge,
    least(greatest(p_discount, 0), v_subtotal + v_service_charge),
    v_tax,
    v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- スタッフ PIN の照合
-- ハッシュ値そのものをアプリ側へ渡さずに済むよう、照合は DB 内で完結させる
-- ---------------------------------------------------------------------------
create or replace function public.verify_staff_pin(
  p_slug text,
  p_pin  text
)
returns uuid
language sql
stable
as $$
  select id
  from public.stores
  where slug = p_slug
    and staff_pin_hash is not null
    and staff_pin_hash = crypt(p_pin, staff_pin_hash);
$$;

-- スタッフ PIN の変更
create or replace function public.set_staff_pin(
  p_store_id uuid,
  p_pin      text
)
returns void
language sql
as $$
  update public.stores
  set staff_pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = p_store_id;
$$;

-- ---------------------------------------------------------------------------
-- 卓を開ける（来店）
-- すでに開いているセッションがあればそれを返す（QR の二重読み取り対策）
-- ---------------------------------------------------------------------------
create or replace function public.open_table_session(
  p_table_id    uuid,
  p_guest_count integer default 1
)
returns uuid
language plpgsql
as $$
declare
  v_store_id   uuid;
  v_session_id uuid;
begin
  select store_id into v_store_id
  from public.restaurant_tables
  where id = p_table_id and is_active;

  if v_store_id is null then
    raise exception 'table % not found or inactive', p_table_id using errcode = 'no_data_found';
  end if;

  -- 同時アクセスで 2 セッション作られないよう卓単位でロックする
  perform pg_advisory_xact_lock(hashtext(p_table_id::text));

  select id into v_session_id
  from public.table_sessions
  where table_id = p_table_id and status in ('open', 'bill_requested')
  limit 1;

  if v_session_id is not null then
    return v_session_id;
  end if;

  insert into public.table_sessions (store_id, table_id, guest_count)
  values (v_store_id, p_table_id, greatest(p_guest_count, 1))
  returning id into v_session_id;

  return v_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 注文を確定する
--
-- p_items の形式:
--   [{ "menu_item_id": "uuid", "quantity": 2, "note": "わさび抜き",
--      "option_ids": ["uuid", "uuid"] }, ...]
--
-- 価格・商品名はここで menu_items / options から引き直してスナップショットする。
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_session_id uuid,
  p_channel    public.order_channel,
  p_items      jsonb,
  p_note       text default null
)
returns uuid
language plpgsql
as $$
declare
  v_session       public.table_sessions%rowtype;
  v_store         public.stores%rowtype;
  v_order_id      uuid;
  v_order_number  integer;
  v_item          jsonb;
  v_menu          public.menu_items%rowtype;
  v_quantity      integer;
  v_option_ids    uuid[];
  v_options_price integer;
  v_options_snap  jsonb;
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

  -- 店舗単位でロックし、伝票番号の重複採番を防ぐ
  perform pg_advisory_xact_lock(hashtext(v_session.store_id::text));

  -- 伝票番号は営業日ごとに 1 から振り直す
  select coalesce(max(o.order_number), 0) + 1 into v_order_number
  from public.orders o
  where o.store_id = v_session.store_id
    and public.business_date(o.placed_at, v_store.timezone, v_store.business_day_cutoff_hour)
        = public.business_date(now(), v_store.timezone, v_store.business_day_cutoff_hour);

  insert into public.orders (store_id, session_id, order_number, channel, note)
  values (v_session.store_id, p_session_id, v_order_number, p_channel, p_note)
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

    v_quantity := greatest(coalesce((v_item ->> 'quantity')::integer, 1), 1);

    -- 選択されたオプションを引き直して金額と表示名を確定する
    select coalesce(array_agg((value #>> '{}')::uuid), '{}')
      into v_option_ids
    from jsonb_array_elements(coalesce(v_item -> 'option_ids', '[]'::jsonb));

    select
      coalesce(sum(o.price_delta), 0),
      coalesce(
        jsonb_agg(jsonb_build_object(
          'group', g.name,
          'name', o.name,
          'price_delta', o.price_delta
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
      v_quantity, coalesce(v_menu.tax_rate, v_store.tax_rate), v_menu.prep_station,
      nullif(v_item ->> 'note', '')
    );
  end loop;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 会計する
-- 金額を確定して payments に残し、セッションを閉じる
-- ---------------------------------------------------------------------------
create or replace function public.checkout_session(
  p_session_id uuid,
  p_method     public.payment_method,
  p_discount   integer default 0,
  p_received   integer default 0,
  p_note       text default null
)
returns uuid
language plpgsql
as $$
declare
  v_session    public.table_sessions%rowtype;
  v_calc       record;
  v_payment_id uuid;
  v_change     integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  select * into v_session from public.table_sessions where id = p_session_id;
  if not found then
    raise exception 'session % not found', p_session_id using errcode = 'no_data_found';
  end if;
  if v_session.status = 'closed' then
    raise exception 'この卓はすでに会計済みです' using errcode = 'check_violation';
  end if;

  select * into v_calc from public.calc_session_total(p_session_id, p_discount);

  if p_method = 'cash' then
    if p_received < v_calc.total then
      raise exception '預かり金が不足しています（合計 %円 / 預かり %円）', v_calc.total, p_received
        using errcode = 'check_violation';
    end if;
    v_change := p_received - v_calc.total;
  else
    -- 現金以外は預かり金の概念がないため、ちょうどの額を受け取ったものとして記録する
    v_change := 0;
  end if;

  insert into public.payments (
    store_id, session_id, method,
    subtotal, discount, service_charge, tax, total,
    received, change_due, note
  )
  values (
    v_session.store_id, p_session_id, p_method,
    v_calc.subtotal, v_calc.discount, v_calc.service_charge, v_calc.tax, v_calc.total,
    case when p_method = 'cash' then p_received else v_calc.total end, v_change, p_note
  )
  returning id into v_payment_id;

  -- 未提供のまま残った明細は提供済みに倒す（会計まで進んでいるため）
  update public.order_items
  set status = 'served'
  where session_id = p_session_id and status in ('pending', 'cooking', 'ready');

  update public.table_sessions
  set status = 'closed', closed_at = now()
  where id = p_session_id;

  return v_payment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 売上サマリ（営業日単位）
-- ---------------------------------------------------------------------------
create or replace function public.sales_summary(
  p_store_id uuid,
  p_from     date,
  p_to       date
)
returns table (
  business_day   date,
  sessions       bigint,
  guests         bigint,
  gross_sales    bigint,
  discount_total bigint,
  tax_total      bigint,
  avg_per_guest  integer
)
language sql
stable
as $$
  with s as (
    select timezone, business_day_cutoff_hour
    from public.stores where id = p_store_id
  )
  select
    public.business_date(p.paid_at, s.timezone, s.business_day_cutoff_hour) as business_day,
    count(*)                                        as sessions,
    coalesce(sum(ts.guest_count), 0)                as guests,
    coalesce(sum(p.total), 0)                       as gross_sales,
    coalesce(sum(p.discount), 0)                    as discount_total,
    coalesce(sum(p.tax), 0)                         as tax_total,
    case
      when coalesce(sum(ts.guest_count), 0) = 0 then 0
      else (sum(p.total) / sum(ts.guest_count))::integer
    end                                             as avg_per_guest
  from public.payments p
  join public.table_sessions ts on ts.id = p.session_id
  cross join s
  where p.store_id = p_store_id
    and p.status = 'paid'
    and public.business_date(p.paid_at, s.timezone, s.business_day_cutoff_hour)
        between p_from and p_to
  group by 1, s.timezone, s.business_day_cutoff_hour
  order by 1 desc;
$$;

-- ---------------------------------------------------------------------------
-- 商品別の売れ筋
-- ---------------------------------------------------------------------------
create or replace function public.item_ranking(
  p_store_id uuid,
  p_from     date,
  p_to       date,
  p_limit    integer default 20
)
returns table (
  name      text,
  quantity  bigint,
  sales     bigint
)
language sql
stable
as $$
  with s as (
    select timezone, business_day_cutoff_hour
    from public.stores where id = p_store_id
  )
  select
    oi.name_snapshot            as name,
    sum(oi.quantity)::bigint    as quantity,
    sum(oi.line_total)::bigint  as sales
  from public.order_items oi
  cross join s
  where oi.store_id = p_store_id
    and oi.status <> 'cancelled'
    and public.business_date(oi.created_at, s.timezone, s.business_day_cutoff_hour)
        between p_from and p_to
  group by oi.name_snapshot
  order by quantity desc
  limit greatest(p_limit, 1);
$$;
