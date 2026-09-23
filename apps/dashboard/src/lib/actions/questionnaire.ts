'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '../auth';
import { db } from '../demo';
import { getQuestionnaireQuestions } from '../extrasQueries';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import { MAX_CUSTOM_QUESTIONS, type QuestionType } from '../types';

/** カスタム設問の編集（仕様書 §5.31）。既定の 27 問は触らず、カスタム分だけ足し引きする */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function requireCrmEdit() {
  const session = await requireSession();
  if (!canEdit(session.permissions, 'crm')) {
    throw new Error('アンケートを編集する権限がありません。');
  }
  return session;
}

export interface CustomQuestionInput {
  id: string;
  questionnaire_id: string;
  text: string;
  type: QuestionType;
  options: string[];
}

export async function saveCustomQuestionAction(
  input: CustomQuestionInput
): Promise<ActionResult> {
  try {
    await requireCrmEdit();

    const text = input.text.trim();
    if (!text) return { ok: false, error: '設問を入力してください。' };

    const options = input.options.map((o) => o.trim()).filter(Boolean);
    if ((input.type === 'choice' || input.type === 'multi_choice') && options.length < 2) {
      return { ok: false, error: '選択肢は 2 つ以上にしてください。' };
    }

    const existing = await getQuestionnaireQuestions(input.questionnaire_id);
    const customs = existing.filter((q) => q.is_custom);
    if (!input.id && customs.length >= MAX_CUSTOM_QUESTIONS) {
      return { ok: false, error: `カスタム設問は ${MAX_CUSTOM_QUESTIONS} 問までです。` };
    }

    const payload = {
      questionnaire_id: input.questionnaire_id,
      text,
      type: input.type,
      options,
      is_custom: true,
      // 既定の設問より後ろに並べる
      display_order: 1000 + customs.length * 10,
    };

    if (isDemoMode()) {
      const state = db();
      if (input.id) {
        const row = state.questionnaireQuestions.find((q) => q.id === input.id);
        if (!row) return { ok: false, error: '設問が見つかりません。' };
        Object.assign(row, { text, type: input.type, options });
      } else {
        state.questionnaireQuestions.push({
          id: `${input.questionnaire_id}-quest-custom-${Date.now()}`,
          ...payload,
        });
      }
    } else {
      const supabase = supabaseAdmin();
      if (input.id) {
        const { error } = await supabase
          .from('questionnaire_questions')
          .update({ text, type: input.type, options })
          .eq('id', input.id)
          .eq('is_custom', true);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('questionnaire_questions').insert(payload);
        if (error) throw error;
      }
    }

    revalidatePath('/companyQuestionnaireExport');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '設問を保存できませんでした' };
  }
}

export async function deleteCustomQuestionAction(questionId: string): Promise<ActionResult> {
  try {
    await requireCrmEdit();

    if (isDemoMode()) {
      const state = db();
      const index = state.questionnaireQuestions.findIndex(
        (q) => q.id === questionId && q.is_custom
      );
      if (index < 0) return { ok: false, error: '設問が見つかりません。' };
      state.questionnaireQuestions.splice(index, 1);
    } else {
      // 既定の 27 問は消せない
      const { error } = await supabaseAdmin()
        .from('questionnaire_questions')
        .delete()
        .eq('id', questionId)
        .eq('is_custom', true);
      if (error) throw error;
    }

    revalidatePath('/companyQuestionnaireExport');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '設問を削除できませんでした' };
  }
}

export interface AnswerCsvResult {
  ok: boolean;
  error?: string;
  name?: string;
  csv?: string;
  count?: number;
}

/** 回答の CSV 書き出し（§5.31 の「カスタムアンケート」の出力） */
export async function exportAnswersCsvAction(shopIds: string[]): Promise<AnswerCsvResult> {
  try {
    const session = await requireSession();

    const allowed = shopIds.filter((id) => session.shops.some((shop) => shop.id === id));
    if (allowed.length === 0) return { ok: false, error: '店舗を選んでください。' };

    const { getQuestionnaireAnswers } = await import('../crmQueries');
    const answers = await getQuestionnaireAnswers(allowed);
    const shopName = new Map(session.shops.map((shop) => [shop.id, shop.name]));

    const escape = (value: string | number) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = [
      '店舗名',
      '回答日時',
      '再来店意欲',
      '接客',
      '料理',
      '提供速度',
      '清潔感',
      '性別',
      '年代',
      '認知経路',
      'コメント',
    ];
    const rows = answers.map((answer) => [
      shopName.get(answer.shop_id) ?? answer.shop_id,
      answer.answered_at,
      answer.revisit_score ?? '',
      answer.service_score ?? '',
      answer.food_score ?? '',
      answer.speed_score ?? '',
      answer.clean_score ?? '',
      answer.gender ?? '',
      answer.age ?? '',
      answer.awareness_channel ?? '',
      answer.comment ?? '',
    ]);

    const csv =
      '\ufeff' +
      [header.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n');

    return { ok: true, name: 'questionnaireAnswers.csv', csv, count: answers.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'CSV を作れませんでした' };
  }
}
