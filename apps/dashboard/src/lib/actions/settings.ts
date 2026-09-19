'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import * as demo from '../demo';
import { canEdit, type FeatureKey, type PermissionMap } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { AccountStatus, RbacScope } from '../types';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

/**
 * 書き込み前の権限チェック。
 * 画面側でもボタンを落としているが、API 側でも必ず通す（仕様書 §10.2 の二重チェック）。
 */
async function requireEdit(feature: FeatureKey) {
  const session = await requireSession();
  if (!canEdit(session.permissions, feature)) {
    throw new Error('この操作を行う権限がありません。');
  }
  return session;
}

// ---------------------------------------------------------------------------
// アカウント
// ---------------------------------------------------------------------------

export async function saveAccountAction(input: {
  id: string;
  email: string;
  name: string;
  roleId: string;
  scopeType: RbacScope;
  scopeIds: string[];
}): Promise<ActionResult> {
  try {
    const session = await requireEdit('account_management');

    const email = input.email.trim();
    const name = input.name.trim();
    if (!email || !name) return { ok: false, error: '氏名とメールアドレスを入力してください。' };
    if (input.scopeType !== 'corporation' && input.scopeIds.length === 0) {
      return { ok: false, error: '適用範囲を 1 つ以上選んでください。' };
    }

    if (isDemoMode()) {
      demo.saveAccount({ ...input, email, name });
    } else {
      const db = supabaseAdmin();

      let accountId = input.id;
      if (accountId) {
        const { error } = await db
          .from('accounts')
          .update({ email, name })
          .eq('id', accountId)
          .eq('corporation_id', session.corporation.id);
        if (error) throw error;
      } else {
        const { data, error } = await db
          .from('accounts')
          .insert({ corporation_id: session.corporation.id, email, name, status: 'invited' })
          .select('id')
          .single();
        if (error) throw error;
        accountId = (data as { id: string }).id;
      }

      const { error: roleError } = await db.from('account_roles').upsert(
        {
          account_id: accountId,
          product: 'pos',
          role_id: input.roleId,
          scope_type: input.scopeType,
          scope_ids: input.scopeIds,
        },
        { onConflict: 'account_id,product' }
      );
      if (roleError) throw roleError;
    }

    revalidatePath('/setting/account');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setAccountStatusAction(
  accountId: string,
  status: AccountStatus
): Promise<ActionResult> {
  try {
    const session = await requireEdit('account_management');

    // 自分自身を無効化して締め出されるのを防ぐ
    if (accountId === session.account.id && status === 'disabled') {
      return { ok: false, error: 'ログイン中のアカウントは無効にできません。' };
    }

    if (isDemoMode()) {
      demo.setAccountStatus(accountId, status);
    } else {
      const { error } = await supabaseAdmin()
        .from('accounts')
        .update({ status })
        .eq('id', accountId)
        .eq('corporation_id', session.corporation.id);
      if (error) throw error;
    }

    revalidatePath('/setting/account');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// 権限設定
// ---------------------------------------------------------------------------

export async function saveRolePermissionsAction(
  roleId: string,
  permissions: PermissionMap
): Promise<ActionResult> {
  try {
    const session = await requireEdit('account_management');

    if (isDemoMode()) {
      demo.saveRolePermissions(roleId, permissions);
    } else {
      const { error } = await supabaseAdmin()
        .from('roles_definitions')
        .update({ permissions })
        .eq('id', roleId)
        .eq('corporation_id', session.corporation.id);
      if (error) throw error;
    }

    revalidatePath('/setting/role');
    // 自分のロールを変えた場合はサイドメニューにも影響する
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
