'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message || '処理に失敗しました' };
}

export interface BotConfigInput {
  id: string;
  group_name: string;
  line_group_id: string;
  shop_ids: string[];
  send_time_min: number;
  items: Record<string, boolean>;
  is_active: boolean;
}

/** レポートくん設定の追加・更新（仕様書 §5.27） */
export async function saveBotConfigAction(input: BotConfigInput): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'analytics')) {
      throw new Error('レポートくんを設定する権限がありません。');
    }

    const groupName = input.group_name.trim();
    if (!groupName) return { ok: false, error: 'グループ名を入力してください。' };

    const payload = {
      group_name: groupName,
      line_group_id: input.line_group_id.trim() || null,
      shop_ids: input.shop_ids,
      send_time_min: input.send_time_min,
      items: input.items,
      is_active: input.is_active,
    };

    let id = input.id;

    if (isDemoMode()) {
      const state = db();
      const existing = state.lineReportingBotConfigs.find((c) => c.id === id);
      if (existing) Object.assign(existing, payload);
      else {
        id = `bot-${Math.random().toString(36).slice(2, 10)}`;
        state.lineReportingBotConfigs.push({
          id,
          corporation_id: session.corporation.id,
          ...payload,
        });
      }
    } else {
      const supabase = supabaseAdmin();
      if (id) {
        const { error } = await supabase
          .from('line_reporting_bot_configs')
          .update(payload)
          .eq('id', id)
          .eq('corporation_id', session.corporation.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('line_reporting_bot_configs')
          .insert({ corporation_id: session.corporation.id, ...payload })
          .select('id')
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }
    }

    revalidatePath('/lineReportingBotConfig/active');
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteBotConfigAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'analytics')) {
      throw new Error('レポートくんを設定する権限がありません。');
    }

    if (isDemoMode()) {
      const state = db();
      state.lineReportingBotConfigs = state.lineReportingBotConfigs.filter((c) => c.id !== id);
    } else {
      const { error } = await supabaseAdmin()
        .from('line_reporting_bot_configs')
        .delete()
        .eq('id', id)
        .eq('corporation_id', session.corporation.id);
      if (error) throw error;
    }

    revalidatePath('/lineReportingBotConfig/active');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
