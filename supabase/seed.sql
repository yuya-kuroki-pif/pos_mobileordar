-- ===========================================================================
-- デモ用シードデータ
--   法人 1 / 業態 1 / 店舗 1 / 卓 8 / カテゴリ 5 / メニュー 26 / オプション 3
--   ダッシュボード: owner@example.com / demo1234
--   店舗端末:       店舗コード demo / PIN 1234
--
-- 何度流しても同じ結果になるよう、先にデモ法人ごと消してから入れ直す。
-- ===========================================================================

-- 既存のデモデータを片付ける。
-- shops.company_id と payments.session_id は on delete restrict なので、
-- 法人を消すだけでは足りない。依存の深い順に落としていく。
do $$
declare
  v_corp uuid;
  v_shops uuid[];
begin
  select id into v_corp from public.corporations where name = 'デモ法人';
  if v_corp is null then return; end if;

  select coalesce(array_agg(s.id), '{}') into v_shops
  from public.shops s
  join public.companies c on c.id = s.company_id
  where c.corporation_id = v_corp;

  delete from public.payments               where store_id = any (v_shops);
  delete from public.order_items            where store_id = any (v_shops);
  delete from public.orders                 where store_id = any (v_shops);
  delete from public.table_sessions         where store_id = any (v_shops);
  delete from public.restaurant_tables      where store_id = any (v_shops);
  delete from public.cash_movements         where store_id = any (v_shops);
  delete from public.cash_drawer_closings   where store_id = any (v_shops);
  delete from public.shop_menus             where shop_id  = any (v_shops);
  delete from public.shops                  where id       = any (v_shops);

  -- 残り（業態・メニュー・アカウント・ロール）は法人の cascade で落ちる
  delete from public.corporations where id = v_corp;
end $$;

do $$
declare
  v_corp_id     uuid;
  v_company_id  uuid;
  v_account_id  uuid;
  v_shop_id     uuid;
  v_cat_kushi   uuid;
  v_cat_robata  uuid;
  v_cat_ippin   uuid;
  v_cat_drink   uuid;
  v_cat_dessert uuid;
  v_opt_size    uuid;
  v_opt_yaki    uuid;
  v_opt_top     uuid;
begin
  -- -------------------------------------------------------------------------
  -- 法人 → 業態 → 店舗
  -- -------------------------------------------------------------------------
  insert into public.corporations (name) values ('デモ法人') returning id into v_corp_id;
  perform public.seed_default_roles(v_corp_id);

  insert into public.companies (corporation_id, name, display_order)
  values (v_corp_id, '炭火焼き デモ業態', 10) returning id into v_company_id;

  -- ダッシュボードにログインする本部アカウント
  insert into public.accounts (corporation_id, email, name, status)
  values (v_corp_id, 'owner@example.com', 'デモ管理者', 'invited')
  returning id into v_account_id;
  perform public.set_account_password(v_account_id, 'demo1234');

  insert into public.account_roles (account_id, product, role_id, scope_type)
  select v_account_id, 'pos', r.id, 'corporation'
  from public.roles_definitions r
  where r.corporation_id = v_corp_id and r.name = '法人管理者';

  insert into public.shops (
    company_id, slug, name, standard_tax_rate, reduced_tax_rate, tax_included,
    service_charge_rate, staff_pin_hash, opening_note,
    invoice_registration_number, cash_float_default, open_time, close_time, display_order
  )
  values (
    v_company_id, 'demo', '炭火焼き デモ店',
    0.1000,   -- 標準税率（店内飲食）
    0.0800,   -- 軽減税率（持ち帰りの飲食料品）
    true,
    0.0000,
    crypt('1234', gen_salt('bf')),
    'ご来店ありがとうございます。ラストオーダーは 23:00 です。',
    'T1234567890123',
    30000,
    '17:00', '23:30', 10
  )
  returning id into v_shop_id;

  -- -------------------------------------------------------------------------
  -- 卓
  -- -------------------------------------------------------------------------
  insert into public.restaurant_tables (store_id, name, area, seats, sort_order) values
    (v_shop_id, 'カウンター1', '1F', 1, 10),
    (v_shop_id, 'カウンター2', '1F', 1, 20),
    (v_shop_id, 'カウンター3', '1F', 1, 30),
    (v_shop_id, 'A-1',        '1F', 4, 40),
    (v_shop_id, 'A-2',        '1F', 4, 50),
    (v_shop_id, 'B-1',        '2F', 6, 60),
    (v_shop_id, 'B-2',        '2F', 6, 70),
    (v_shop_id, '個室',        '2F', 8, 80);

  -- -------------------------------------------------------------------------
  -- カテゴリ（業態単位）
  -- -------------------------------------------------------------------------
  insert into public.categories (company_id, name, description, display_order)
    values (v_company_id, '串焼き', '備長炭で一本ずつ焼き上げます', 10) returning id into v_cat_kushi;
  insert into public.categories (company_id, name, description, display_order)
    values (v_company_id, '炉端焼き', '旬の魚介と野菜を炭火で', 20) returning id into v_cat_robata;
  insert into public.categories (company_id, name, description, display_order)
    values (v_company_id, '一品料理', null, 30) returning id into v_cat_ippin;
  insert into public.categories (company_id, name, description, display_order)
    values (v_company_id, 'ドリンク', null, 40) returning id into v_cat_drink;
  insert into public.categories (company_id, name, description, display_order)
    values (v_company_id, 'デザート', null, 50) returning id into v_cat_dessert;

  -- -------------------------------------------------------------------------
  -- オプションと選択肢
  -- -------------------------------------------------------------------------
  insert into public.options (company_id, name, receipt_display_name, min_choice, max_choice, display_order)
    values (v_company_id, '焼き加減', '焼き加減', 0, 1, 10) returning id into v_opt_yaki;
  insert into public.choices (option_id, name, receipt_display_name, price, display_order, is_default) values
    (v_opt_yaki, 'おまかせ',   'おまかせ',   0, 10, true),
    (v_opt_yaki, 'しっかりめ', 'しっかりめ', 0, 20, false),
    (v_opt_yaki, 'レアめ',     'レアめ',     0, 30, false);

  insert into public.options (company_id, name, receipt_display_name, min_choice, max_choice, display_order)
    values (v_company_id, 'サイズ', 'サイズ', 1, 1, 20) returning id into v_opt_size;
  insert into public.choices (option_id, name, receipt_display_name, price, display_order, is_default) values
    (v_opt_size, 'レギュラー',   'レギュラー',     0, 10, true),
    (v_opt_size, 'メガジョッキ', 'メガジョッキ', 250, 20, false);

  insert into public.options (company_id, name, receipt_display_name, min_choice, max_choice, display_order)
    values (v_company_id, 'トッピング', 'トッピング', 0, 3, 30) returning id into v_opt_top;
  insert into public.choices (option_id, name, receipt_display_name, price, display_order) values
    (v_opt_top, '温玉',       '温玉',       100, 10),
    (v_opt_top, 'マヨネーズ', 'マヨネーズ',  50, 20),
    (v_opt_top, '七味',       '七味',         0, 30),
    (v_opt_top, 'チーズ',     'チーズ',     150, 40);

  -- -------------------------------------------------------------------------
  -- メニュー（業態単位）。作ったそばからカテゴリへ紐付ける
  --
  -- reduced_rate_eligible は仕様書に無い拡張で、持ち帰り時に軽減税率 8% を
  -- 適用できるかを表す。酒類は持ち帰りでも標準税率なので false にする。
  -- -------------------------------------------------------------------------
  with ins as (
    insert into public.menus
      (company_id, name, receipt_display_name, description, price, menu_type, prep_station, display_order, reduced_rate_eligible)
    values
      (v_company_id, 'もも串',             'もも串',   '大山鶏のもも肉。塩 / タレ', 280, 'food', 'kitchen', 10, true),
      (v_company_id, 'ねぎま',             'ねぎま',   '九条ねぎともも肉',          300, 'food', 'kitchen', 20, true),
      (v_company_id, 'つくね（卵黄付き）', 'つくね',   '軟骨入りの粗挽きつくね',    380, 'food', 'kitchen', 30, true),
      (v_company_id, '皮',                 '皮',       'パリパリに焼き上げます',    250, 'food', 'kitchen', 40, true),
      (v_company_id, 'ハツ',               'ハツ',     null,                       280, 'food', 'kitchen', 50, true),
      (v_company_id, '砂肝',               '砂肝',     null,                       280, 'food', 'kitchen', 60, true),
      (v_company_id, 'レバー',             'レバー',   '低温で仕上げたレア食感',    300, 'food', 'kitchen', 70, true),
      (v_company_id, '手羽先',             '手羽先',   null,                       350, 'food', 'kitchen', 80, true)
    returning id, display_order
  )
  insert into public.category_menus (category_id, menu_id, display_order)
  select v_cat_kushi, id, display_order from ins;

  with ins as (
    insert into public.menus
      (company_id, name, receipt_display_name, description, price, menu_type, prep_station, display_order, reduced_rate_eligible)
    values
      (v_company_id, 'ホッケ開き',       'ホッケ',       '脂のりの良い真ほっけ', 980, 'food', 'kitchen', 110, true),
      (v_company_id, '金目鯛の塩焼き',   '金目鯛',       '時価。本日は 1 尾',   1580, 'food', 'kitchen', 120, true),
      (v_company_id, 'ハマグリ酒蒸し',   'ハマグリ',     null,                   880, 'food', 'kitchen', 130, true),
      (v_company_id, '大きな椎茸',       '椎茸',         '肉厚の原木しいたけ',   420, 'food', 'kitchen', 140, true),
      (v_company_id, '焼きとうもろこし', 'とうもろこし', '醤油バター',           480, 'food', 'kitchen', 150, true)
    returning id, display_order
  )
  insert into public.category_menus (category_id, menu_id, display_order)
  select v_cat_robata, id, display_order from ins;

  with ins as (
    insert into public.menus
      (company_id, name, receipt_display_name, description, price, menu_type, prep_station, display_order, reduced_rate_eligible)
    values
      (v_company_id, 'ポテトフライ',   'ポテト',   'ほくほくの国産じゃがいも', 480, 'food', 'kitchen', 210, true),
      (v_company_id, 'だし巻き玉子',   'だし巻き', '大根おろし添え',           580, 'food', 'kitchen', 220, true),
      (v_company_id, '自家製ポテサラ', 'ポテサラ', null,                      420, 'food', 'kitchen', 230, true),
      (v_company_id, '枝豆',           '枝豆',     null,                      380, 'food', 'kitchen', 240, true),
      (v_company_id, '冷やしトマト',   'トマト',   null,                      420, 'food', 'kitchen', 250, true)
    returning id, display_order
  )
  insert into public.category_menus (category_id, menu_id, display_order)
  select v_cat_ippin, id, display_order from ins;

  with ins as (
    insert into public.menus
      (company_id, name, receipt_display_name, description, price, menu_type, prep_station, display_order, reduced_rate_eligible)
    values
      (v_company_id, '生ビール',     '生ビール',     'アサヒスーパードライ',  580, 'drink', 'bar', 310, false),
      (v_company_id, 'ハイボール',   'ハイボール',   '角ハイボール',          480, 'drink', 'bar', 320, false),
      (v_company_id, 'レモンサワー', 'レモンサワー', '自家製レモンシロップ',  480, 'drink', 'bar', 330, false),
      (v_company_id, '日本酒（冷）', '日本酒',       '本日のおすすめ一合',    780, 'drink', 'bar', 340, false),
      (v_company_id, '烏龍茶',       '烏龍茶',       null,                    350, 'drink', 'bar', 350, true),
      (v_company_id, 'コーラ',       'コーラ',       null,                    350, 'drink', 'bar', 360, true)
    returning id, display_order
  )
  insert into public.category_menus (category_id, menu_id, display_order)
  select v_cat_drink, id, display_order from ins;

  with ins as (
    insert into public.menus
      (company_id, name, receipt_display_name, description, price, menu_type, prep_station, display_order, reduced_rate_eligible)
    values
      (v_company_id, 'バニラアイス',       'アイス',       null,   380, 'other', 'none', 410, true),
      (v_company_id, '本日のシャーベット', 'シャーベット', '柚子', 420, 'other', 'none', 420, true)
    returning id, display_order
  )
  insert into public.category_menus (category_id, menu_id, display_order)
  select v_cat_dessert, id, display_order from ins;

  -- -------------------------------------------------------------------------
  -- メニュー ↔ オプション
  -- -------------------------------------------------------------------------
  insert into public.menu_options (menu_id, option_id, display_order)
  select m.id, v_opt_yaki, 10 from public.menus m
  where m.company_id = v_company_id and m.name in ('もも串', 'ねぎま');

  insert into public.menu_options (menu_id, option_id, display_order)
  select m.id, v_opt_top, 10 from public.menus m
  where m.company_id = v_company_id and m.name = 'ポテトフライ';

  insert into public.menu_options (menu_id, option_id, display_order)
  select m.id, v_opt_size, 10 from public.menus m
  where m.company_id = v_company_id and m.name = '生ビール';

  -- -------------------------------------------------------------------------
  -- 店舗ごとの取扱設定。既定は全品を扱い、在庫ありにする
  -- -------------------------------------------------------------------------
  insert into public.shop_menus (shop_id, menu_id, display_order)
  select v_shop_id, m.id, m.display_order
  from public.menus m
  where m.company_id = v_company_id;

  -- 売切の見え方を確認できるよう 1 品だけ落としておく
  update public.shop_menus sm
  set in_stock = false
  from public.menus m
  where m.id = sm.menu_id and sm.shop_id = v_shop_id and m.name = 'ハマグリ酒蒸し';

  raise notice 'seed 完了: corporation=% company=% shop=%', v_corp_id, v_company_id, v_shop_id;
end;
$$;
