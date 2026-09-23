-- ===========================================================================
-- 既定ロールの取りこぼし修正
--
-- attract_all がどのロールにも入っておらず、集客セクションのサイドメニューが
-- 全ロールで空になっていた（画面はあるのに辿り着けない状態）。
-- account_audit_logs も全ロール none で、アカウント操作履歴に誰も入れなかったため、
-- 法人単位の監査という性格に合わせて法人管理者だけ view にする。
-- ===========================================================================

update public.roles_definitions
set permissions = permissions
  || jsonb_build_object('attract_all', 'edit')
  || jsonb_build_object('account_audit_logs', 'view')
where is_system and name = '法人管理者' and product = 'pos';

update public.roles_definitions
set permissions = permissions || jsonb_build_object('attract_all', 'edit')
where is_system and name = '業態管理者' and product = 'pos';

update public.roles_definitions
set permissions = permissions || jsonb_build_object('attract_all', 'view')
where is_system and name = '店舗管理者' and product = 'pos';
