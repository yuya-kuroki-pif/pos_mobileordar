'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import type { CustomReport } from '../types';

/** カスタムレポート（仕様書 §6.9）。指標と絞り込みの組み合わせを保存しておく */

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface CustomReportInput {
  id: string;
  name: string;
  share_scope: 'private' | 'corporation';
  source: 'sales' | 'menu' | 'survey';
  metrics: string[];
  group_by: string;
  shop_ids: string[];
}

export async function saveCustomReportAction(input: CustomReportInput): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'analytics')) {
      return { ok: false, error: 'レポートを保存する権限がありません。' };
    }

    const name = input.name.trim();
    if (!name) return { ok: false, error: 'レポート名を入力してください。' };
    if (input.metrics.length === 0) return { ok: false, error: '指標を 1 つ以上選んでください。' };

    const definition = {
      source: input.source,
      metrics: input.metrics,
      group_by: input.group_by,
      shop_ids: input.shop_ids,
    };

    if (isDemoMode()) {
      const state = db();
      if (input.id) {
        const row = state.customReports.find((r) => r.id === input.id);
        if (!row) return { ok: false, error: 'レポートが見つかりません。' };
        Object.assign(row, {
          name,
          share_scope: input.share_scope,
          definition,
          updated_at: new Date().toISOString(),
        });
        return { ok: true, id: row.id };
      }

      const created: CustomReport = {
        id: `report-${Date.now()}`,
        corporation_id: session.corporation.id,
        name,
        owner_account_id: session.account.id,
        owner_name: session.account.name,
        share_scope: input.share_scope,
        definition,
        updated_at: new Date().toISOString(),
      };
      state.customReports.push(created);
      revalidatePath('/bi/customReports');
      return { ok: true, id: created.id };
    }

    const supabase = supabaseAdmin();
    const payload = {
      corporation_id: session.corporation.id,
      name,
      owner_account_id: session.account.id,
      share_scope: input.share_scope,
      definition,
    };

    if (input.id) {
      const { error } = await supabase
        .from('custom_reports')
        .update(payload)
        .eq('id', input.id)
        .eq('corporation_id', session.corporation.id);
      if (error) throw error;
      revalidatePath('/bi/customReports');
      return { ok: true, id: input.id };
    }

    const { data, error } = await supabase
      .from('custom_reports')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;

    revalidatePath('/bi/customReports');
    return { ok: true, id: (data as { id: string }).id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'レポートを保存できませんでした' };
  }
}

export async function deleteCustomReportAction(reportId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'analytics')) {
      return { ok: false, error: 'レポートを削除する権限がありません。' };
    }

    if (isDemoMode()) {
      const state = db();
      const index = state.customReports.findIndex((r) => r.id === reportId);
      if (index < 0) return { ok: false, error: 'レポートが見つかりません。' };
      state.customReports.splice(index, 1);
    } else {
      const { error } = await supabaseAdmin()
        .from('custom_reports')
        .delete()
        .eq('id', reportId)
        .eq('corporation_id', session.corporation.id);
      if (error) throw error;
    }

    revalidatePath('/bi/customReports');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'レポートを削除できませんでした' };
  }
}
