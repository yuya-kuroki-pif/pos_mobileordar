-- ===========================================================================
-- 残りの画面が必要とする表
--   §5.31 カスタムアンケート（設問）
--   §5.32 メッセージ配信分析 / クーポン利用分析（実績の受け皿）
--   §7.2  クチコミ獲得（Google ビジネスプロフィール）
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- §8.6 アンケートの設問。既定 27 問 + カスタム最大 5 問
-- ---------------------------------------------------------------------------
create type public.question_type as enum ('score', 'choice', 'multi_choice', 'text');

create table public.questionnaire_questions (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires (id) on delete cascade,
  text             text not null,
  type             public.question_type not null default 'score',
  options          jsonb not null default '[]'::jsonb,
  is_custom        boolean not null default false,
  display_order    integer not null default 0
);

create index on public.questionnaire_questions (questionnaire_id, display_order);

-- ---------------------------------------------------------------------------
-- §5.32 メッセージ配信分析。配信が「来店につながったか」まで持つ
-- ---------------------------------------------------------------------------
alter table public.message_delivery_jobs
  add column shop_id             uuid references public.shops (id) on delete cascade,
  add column visited_count       integer not null default 0,
  add column visited_group_count integer not null default 0,
  add column effect_sales        integer not null default 0;

create index on public.message_delivery_jobs (shop_id, sent_at desc);

-- §5.32 クーポン利用分析。使われた会計の金額を持たせて効果売上を出す
alter table public.customer_coupons
  add column effect_sales integer not null default 0;

create index on public.customer_coupons (used_shop_id, used_at desc);

-- ---------------------------------------------------------------------------
-- §7.2 クチコミ獲得（Google ビジネスプロフィール）
-- 連携前でも画面が成り立つよう、接続状態を明示的に持つ
-- ---------------------------------------------------------------------------
create table public.google_business_profiles (
  shop_id      uuid primary key references public.shops (id) on delete cascade,
  location_id  text,
  account_name text,
  is_connected boolean not null default false,
  synced_at    timestamptz
);

create table public.google_reviews (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  review_id   text,
  author_name text,
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  posted_at   timestamptz not null default now(),
  reply_text  text,
  replied_at  timestamptz
);

create index on public.google_reviews (shop_id, posted_at desc);

-- ---------------------------------------------------------------------------
-- RLS。他と同じく全拒否で、アクセスはサーバー経由のみ
-- ---------------------------------------------------------------------------
alter table public.questionnaire_questions  enable row level security;
alter table public.google_business_profiles enable row level security;
alter table public.google_reviews           enable row level security;

revoke all on table
  public.questionnaire_questions, public.google_business_profiles, public.google_reviews
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- §6.9 調理・配膳時間分析。KDS が打刻する 3 点を注文明細に持たせる
-- ---------------------------------------------------------------------------
alter table public.order_items
  add column cooked_at    timestamptz,
  add column picked_up_at timestamptz,
  add column served_at    timestamptz;

create index on public.order_items (served_at);

-- ---------------------------------------------------------------------------
-- 画像の置き場（§5.3 メニュー画像 / §5.30 クーポン画像 など）
-- 読み取りは公開（モバイルオーダーから見える必要がある）、
-- 書き込みはサーバー経由（service_role）だけ
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-images',
  'public-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
