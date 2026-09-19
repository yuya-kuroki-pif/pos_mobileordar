-- カテゴリの多言語。モバイルオーダーのカテゴリタブに出すため
-- （メニュー・オプション・選択肢は既に翻訳テーブルを持っている）
create table public.category_translations (
  category_id uuid not null references public.categories (id) on delete cascade,
  locale      public.locale not null,
  name        text,
  primary key (category_id, locale)
);

alter table public.category_translations enable row level security;
revoke all on table public.category_translations from anon, authenticated;
