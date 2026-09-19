-- ===========================================================================
-- Row Level Security
--
-- 方針: ブラウザから Supabase を直接叩かせない。
--   - anon / authenticated ロールは全テーブル「拒否」（ポリシーを 1 つも作らない）
--   - アクセスはすべて Next.js のサーバー側（API Route / Server Action）経由
--   - サーバーは service_role キーを使う。service_role は RLS を迂回する
--
-- これにより「QR トークンを知っている人だけが自分の卓を操作できる」といった
-- 判定をアプリ側の 1 箇所に集約でき、ポリシーの書き漏れで漏洩する事故を防げる。
-- 将来スタッフ向けに Supabase Auth を導入する場合は、このファイルに
-- authenticated 向けポリシーを追加していく。
-- ===========================================================================

alter table public.stores                  enable row level security;
alter table public.restaurant_tables       enable row level security;
alter table public.categories              enable row level security;
alter table public.menu_items              enable row level security;
alter table public.option_groups           enable row level security;
alter table public.options                 enable row level security;
alter table public.menu_item_option_groups enable row level security;
alter table public.table_sessions          enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.payments                enable row level security;

-- 念のため明示的に権限を剥奪する。
-- （Supabase の既定では anon / authenticated に public スキーマの権限が付与される）
--
-- ここで `all tables in schema public` を使わないのは意図的。
-- 1 つの Supabase プロジェクトに別アプリのテーブルが同居している場合、
-- その一括指定は無関係なテーブルの権限まで剥奪して他アプリを壊す。
-- 対象は必ずこのシステムのテーブルだけに限定する。
revoke all on table
  public.stores,
  public.restaurant_tables,
  public.categories,
  public.menu_items,
  public.option_groups,
  public.options,
  public.menu_item_option_groups,
  public.table_sessions,
  public.orders,
  public.order_items,
  public.payments
from anon, authenticated;

-- 主キーはすべて uuid で serial を使っていないため、剥奪すべきシーケンスはない。

-- RPC 関数もサーバー経由でのみ呼べるようにする
revoke all on function public.open_table_session(uuid, integer)                             from anon, authenticated;
revoke all on function public.place_order(uuid, public.order_channel, jsonb, text)          from anon, authenticated;
revoke all on function public.checkout_session(uuid, public.payment_method, integer, integer, text) from anon, authenticated;
revoke all on function public.calc_session_total(uuid, integer)                             from anon, authenticated;
revoke all on function public.sales_summary(uuid, date, date)                               from anon, authenticated;
revoke all on function public.item_ranking(uuid, date, date, integer)                       from anon, authenticated;
revoke all on function public.verify_staff_pin(text, text)                                  from anon, authenticated;
revoke all on function public.set_staff_pin(uuid, text)                                     from anon, authenticated;
