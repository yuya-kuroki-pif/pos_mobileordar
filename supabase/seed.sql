-- ===========================================================================
-- デモ用シードデータ
--   店舗 1 / 卓 8 / カテゴリ 5 / 商品 24 / オプション 3 グループ
--   スタッフ PIN は 1234
--
-- 何度流しても同じ結果になるよう、先にデモ店舗を消してから入れ直す。
-- ===========================================================================

delete from public.stores where slug = 'demo';

do $$
declare
  v_store_id uuid;
  v_cat_kushi   uuid;
  v_cat_robata  uuid;
  v_cat_ippin   uuid;
  v_cat_drink   uuid;
  v_cat_dessert uuid;
  v_grp_size    uuid;
  v_grp_yakikata uuid;
  v_grp_topping uuid;
  v_item        uuid;
begin
  -- -------------------------------------------------------------------------
  -- 店舗
  -- -------------------------------------------------------------------------
  insert into public.stores (slug, name, tax_rate, tax_included, service_charge_rate, staff_pin_hash, opening_note)
  values (
    'demo',
    '炭火焼き デモ店',
    0.1000,
    true,
    0.0000,
    crypt('1234', gen_salt('bf')),
    'ご来店ありがとうございます。ラストオーダーは 23:00 です。'
  )
  returning id into v_store_id;

  -- -------------------------------------------------------------------------
  -- 卓
  -- -------------------------------------------------------------------------
  insert into public.restaurant_tables (store_id, name, area, seats, sort_order) values
    (v_store_id, 'カウンター1', '1F', 1, 10),
    (v_store_id, 'カウンター2', '1F', 1, 20),
    (v_store_id, 'カウンター3', '1F', 1, 30),
    (v_store_id, 'A-1',        '1F', 4, 40),
    (v_store_id, 'A-2',        '1F', 4, 50),
    (v_store_id, 'B-1',        '2F', 6, 60),
    (v_store_id, 'B-2',        '2F', 6, 70),
    (v_store_id, '個室',        '2F', 8, 80);

  -- -------------------------------------------------------------------------
  -- カテゴリ
  -- -------------------------------------------------------------------------
  insert into public.categories (store_id, name, description, sort_order)
    values (v_store_id, '串焼き', '備長炭で一本ずつ焼き上げます', 10)
    returning id into v_cat_kushi;
  insert into public.categories (store_id, name, description, sort_order)
    values (v_store_id, '炉端焼き', '旬の魚介と野菜を炭火で', 20)
    returning id into v_cat_robata;
  insert into public.categories (store_id, name, description, sort_order)
    values (v_store_id, '一品料理', null, 30)
    returning id into v_cat_ippin;
  insert into public.categories (store_id, name, description, sort_order)
    values (v_store_id, 'ドリンク', null, 40)
    returning id into v_cat_drink;
  insert into public.categories (store_id, name, description, sort_order)
    values (v_store_id, 'デザート', null, 50)
    returning id into v_cat_dessert;

  -- -------------------------------------------------------------------------
  -- オプショングループ
  -- -------------------------------------------------------------------------
  insert into public.option_groups (store_id, name, min_select, max_select, sort_order)
    values (v_store_id, '焼き加減', 0, 1, 10)
    returning id into v_grp_yakikata;
  insert into public.options (group_id, name, price_delta, sort_order) values
    (v_grp_yakikata, 'おまかせ', 0, 10),
    (v_grp_yakikata, 'しっかりめ', 0, 20),
    (v_grp_yakikata, 'レアめ', 0, 30);

  insert into public.option_groups (store_id, name, min_select, max_select, sort_order)
    values (v_store_id, 'サイズ', 1, 1, 20)
    returning id into v_grp_size;
  insert into public.options (group_id, name, price_delta, sort_order) values
    (v_grp_size, 'レギュラー', 0, 10),
    (v_grp_size, 'メガジョッキ', 250, 20);

  insert into public.option_groups (store_id, name, min_select, max_select, sort_order)
    values (v_store_id, 'トッピング', 0, 3, 30)
    returning id into v_grp_topping;
  insert into public.options (group_id, name, price_delta, sort_order) values
    (v_grp_topping, '温玉', 100, 10),
    (v_grp_topping, 'マヨネーズ', 50, 20),
    (v_grp_topping, '七味', 0, 30),
    (v_grp_topping, 'チーズ', 150, 40);

  -- -------------------------------------------------------------------------
  -- 商品
  -- -------------------------------------------------------------------------

  -- 串焼き（焼き加減オプション付き）
  insert into public.menu_items (store_id, category_id, name, description, price, prep_station, sort_order)
    values (v_store_id, v_cat_kushi, 'もも串', '大山鶏のもも肉。塩 / タレ', 280, 'kitchen', 10)
    returning id into v_item;
  insert into public.menu_item_option_groups values (v_item, v_grp_yakikata, 10);

  insert into public.menu_items (store_id, category_id, name, description, price, prep_station, sort_order)
    values (v_store_id, v_cat_kushi, 'ねぎま', '九条ねぎともも肉', 300, 'kitchen', 20)
    returning id into v_item;
  insert into public.menu_item_option_groups values (v_item, v_grp_yakikata, 10);

  insert into public.menu_items (store_id, category_id, name, description, price, prep_station, sort_order) values
    (v_store_id, v_cat_kushi, 'つくね（卵黄付き）', '軟骨入りの粗挽きつくね', 380, 'kitchen', 30),
    (v_store_id, v_cat_kushi, '皮',                'パリパリに焼き上げます',   250, 'kitchen', 40),
    (v_store_id, v_cat_kushi, 'ハツ',              null,                     280, 'kitchen', 50),
    (v_store_id, v_cat_kushi, '砂肝',              null,                     280, 'kitchen', 60),
    (v_store_id, v_cat_kushi, 'レバー',            '低温で仕上げたレア食感',   300, 'kitchen', 70),
    (v_store_id, v_cat_kushi, '手羽先',            null,                     350, 'kitchen', 80);

  -- 炉端焼き
  insert into public.menu_items (store_id, category_id, name, description, price, prep_station, sort_order) values
    (v_store_id, v_cat_robata, 'ホッケ開き',       '脂のりの良い真ほっけ',      980, 'kitchen', 10),
    (v_store_id, v_cat_robata, '金目鯛の塩焼き',   '時価。本日は 1 尾',       1580, 'kitchen', 20),
    (v_store_id, v_cat_robata, 'ハマグリ酒蒸し',   null,                      880, 'kitchen', 30),
    (v_store_id, v_cat_robata, '大きな椎茸',       '肉厚の原木しいたけ',        420, 'kitchen', 40),
    (v_store_id, v_cat_robata, '焼きとうもろこし', '醤油バター',                480, 'kitchen', 50);

  -- 一品料理（トッピングオプション付きのものあり）
  insert into public.menu_items (store_id, category_id, name, description, price, prep_station, sort_order)
    values (v_store_id, v_cat_ippin, 'ポテトフライ', 'ほくほくの国産じゃがいも', 480, 'kitchen', 10)
    returning id into v_item;
  insert into public.menu_item_option_groups values (v_item, v_grp_topping, 10);

  insert into public.menu_items (store_id, category_id, name, description, price, prep_station, sort_order) values
    (v_store_id, v_cat_ippin, 'だし巻き玉子',   '大根おろし添え',         580, 'kitchen', 20),
    (v_store_id, v_cat_ippin, '自家製ポテサラ', null,                    420, 'kitchen', 30),
    (v_store_id, v_cat_ippin, '枝豆',           null,                    380, 'kitchen', 40),
    (v_store_id, v_cat_ippin, '冷やしトマト',   null,                    420, 'kitchen', 50);

  -- ドリンク（サイズオプション付き）
  insert into public.menu_items (store_id, category_id, name, description, price, prep_station, sort_order)
    values (v_store_id, v_cat_drink, '生ビール', 'アサヒスーパードライ', 580, 'bar', 10)
    returning id into v_item;
  insert into public.menu_item_option_groups values (v_item, v_grp_size, 10);

  insert into public.menu_items (store_id, category_id, name, description, price, prep_station, sort_order) values
    (v_store_id, v_cat_drink, 'ハイボール',     '角ハイボール',      480, 'bar', 20),
    (v_store_id, v_cat_drink, 'レモンサワー',   '自家製レモンシロップ', 480, 'bar', 30),
    (v_store_id, v_cat_drink, '日本酒（冷）',   '本日のおすすめ一合',  780, 'bar', 40),
    (v_store_id, v_cat_drink, '烏龍茶',         null,                 350, 'bar', 50),
    (v_store_id, v_cat_drink, 'コーラ',         null,                 350, 'bar', 60);

  -- デザート
  insert into public.menu_items (store_id, category_id, name, description, price, prep_station, sort_order) values
    (v_store_id, v_cat_dessert, 'バニラアイス',   null,            380, 'none', 10),
    (v_store_id, v_cat_dessert, '本日のシャーベット', '柚子',      420, 'none', 20);

  raise notice 'seed 完了: store_id = %', v_store_id;
end;
$$;
