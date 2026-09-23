-- ===========================================================================
-- レジ会計を支払方法マスターにつなぐ（仕様書 §5.10 / §5.23）
--
-- enum の method は既存の帳票・集計がそのまま使えるよう残し、
-- どのマスター行（payment_methods）を選んだかを payment_method_id で持たせる。
-- 引数を足すだけだと旧シグネチャとの多重定義になってしまうので、
-- 一度落としてから 1 本で作り直している。
-- ===========================================================================

drop function if exists public.checkout_payment(uuid,public.payment_method,integer,integer,text,uuid[],integer,integer);
drop function if exists public.checkout_payment(uuid,public.payment_method,integer,integer,text,uuid[],integer,integer,uuid);

create or replace function public.checkout_payment(
  p_session_id  uuid,
  p_method      public.payment_method,
  p_discount    integer default 0,
  p_received    integer default 0,
  p_note        text default null,
  p_item_ids    uuid[] default null,
  p_split_count integer default 1,
  p_split_index integer default 1,
  p_payment_method_id uuid default null
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
    received, change_due, note, tax_breakdown, split_count, split_index,
    payment_method_id
  )
  values (
    v_session.store_id, p_session_id, p_method,
    round(v_calc.subtotal * v_ratio)::integer,
    round(v_calc.discount * v_ratio)::integer,
    round(v_calc.service_charge * v_ratio)::integer,
    round(v_calc.tax * v_ratio)::integer,
    v_amount,
    case when p_method = 'cash' then p_received else v_amount end,
    v_change, p_note, v_breakdown, p_split_count, p_split_index,
    p_payment_method_id
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