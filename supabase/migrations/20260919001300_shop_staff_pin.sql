-- 配布物画面（仕様書 §5.21）からレジ・ハンディの PIN を再発行する。
-- 保存はハッシュのみで、平文は発行直後に画面へ 1 回返すだけ。
create or replace function public.set_shop_staff_pin(
  p_shop_id uuid,
  p_pin     text
)
returns void
language plpgsql
as $$
begin
  if p_pin is null or length(p_pin) < 4 then
    raise exception 'PIN は 4 文字以上にしてください';
  end if;

  update public.shops
  set staff_pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = p_shop_id;

  if not found then
    raise exception '店舗が見つかりません';
  end if;
end;
$$;

revoke all on function public.set_shop_staff_pin(uuid, text) from anon, authenticated;
