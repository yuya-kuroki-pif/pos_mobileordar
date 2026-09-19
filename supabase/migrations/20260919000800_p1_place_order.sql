-- ===========================================================================
-- P1: メニューマスター移行にあわせて place_order を更新
--
-- 変更点:
--   - menu_items → menus、option_groups → options、options → choices
--   - 販売可否は店舗ごとの shop_menus で判定する
--   - 税率は menus.tax_rate を基準にし、持ち帰りかつ軽減税率対象のときだけ
--     店舗の reduced_tax_rate へ落とす
-- ===========================================================================

create or replace function public.place_order(
  p_session_id   uuid,
  p_channel      public.order_channel,
  p_items        jsonb,
  p_note         text default null,
  p_service_type public.service_type default null
)
returns uuid
language plpgsql
as $$
declare
  v_session       public.table_sessions%rowtype;
  v_store         public.shops%rowtype;
  v_service_type  public.service_type;
  v_order_id      uuid;
  v_order_number  integer;
  v_item          jsonb;
  v_menu          public.menus%rowtype;
  v_deal          public.shop_menus%rowtype;
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

  select * into v_store from public.shops where id = v_session.store_id;
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
    -- メニューは業態単位。店舗が扱っているかは shop_menus で確かめる
    select m.* into v_menu
    from public.menus m
    where m.id = (v_item ->> 'menu_id')::uuid
      and m.company_id = v_store.company_id;

    if not found then
      raise exception '商品が見つかりません: %', v_item ->> 'menu_id'
        using errcode = 'no_data_found';
    end if;
    if v_menu.is_notice_only then
      raise exception '「%」は注文できません', v_menu.name using errcode = 'check_violation';
    end if;

    select * into v_deal
    from public.shop_menus
    where shop_id = v_session.store_id and menu_id = v_menu.id;

    if not found or not v_deal.is_dealing or not v_deal.in_stock then
      raise exception '「%」は現在ご注文いただけません', v_menu.name
        using errcode = 'check_violation';
    end if;

    -- 持ち帰りの飲食料品だけが軽減税率。酒類・非飲食料品は商品の税率のまま
    v_tax_rate := case
      when v_service_type = 'takeout' and v_menu.reduced_rate_eligible
      then v_store.reduced_tax_rate
      else v_menu.tax_rate
    end;

    v_quantity := greatest(coalesce((v_item ->> 'quantity')::integer, 1), 1);

    select coalesce(array_agg((value #>> '{}')::uuid), '{}')
      into v_option_ids
    from jsonb_array_elements(coalesce(v_item -> 'choice_ids', '[]'::jsonb));

    select
      coalesce(sum(c.price), 0),
      coalesce(
        jsonb_agg(jsonb_build_object(
          'group', o.name, 'name', c.name, 'price_delta', c.price
        ) order by o.display_order, c.display_order),
        '[]'::jsonb
      )
    into v_options_price, v_options_snap
    from public.choices c
    join public.options o on o.id = c.option_id
    where c.id = any (v_option_ids)
      and c.is_available
      and o.company_id = v_store.company_id;

    insert into public.order_items (
      store_id, order_id, session_id, menu_id,
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

revoke all on function public.place_order(uuid, public.order_channel, jsonb, text, public.service_type)
  from anon, authenticated;
