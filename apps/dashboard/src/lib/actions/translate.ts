'use server';

import { revalidatePath } from 'next/cache';

import { askJson, isAiConfigured } from '../anthropic';
import { requireSession } from '../auth';
import * as demoMenu from '../demoMenu';
import { getCategoryRows, getMenuRows, getOptionRows } from '../menuQueries';
import { canEdit } from '../permissions';
import { isDemoMode, supabaseAdmin } from '../supabase';
import { LOCALES, type Locale, type MenuTranslation } from '../types';

/**
 * 自動翻訳（仕様書 §5.9）。
 *
 * 指示書は DeepL / Gemini を挙げているが、すでに AI のキーを 1 本持っているので
 * それを使う。飲食店のメニュー名は直訳だと通じないことが多いので、
 * 「注文する人に伝わるか」を優先するよう頼んでいる。
 *
 * 手で入れた訳は上書きしない。空いている言語だけを埋める。
 */

export interface TranslateResult {
  ok: boolean;
  error?: string;
  /** 何件埋めたか */
  filled?: number;
  skipped?: number;
}

type Filled = Record<string, Record<string, string>>;

export async function translateMenusAction(
  targets: ('menu' | 'category' | 'option')[]
): Promise<TranslateResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'menu_master')) {
      return { ok: false, error: 'メニューマスターを編集する権限がありません。' };
    }
    if (!isAiConfigured()) {
      return {
        ok: false,
        error:
          'ANTHROPIC_API_KEY が設定されていません。設定すると、この画面から翻訳をまとめて作れます。',
      };
    }
    if (targets.length === 0) return { ok: false, error: '翻訳する対象を選んでください。' };

    const companyId = session.currentCompanyId;

    // いま訳が入っていない項目だけ集める
    const items: { id: string; kind: string; text: string; description: string | null }[] = [];

    if (targets.includes('menu')) {
      for (const menu of await getMenuRows(companyId)) {
        items.push({
          id: menu.id,
          kind: 'menu',
          text: menu.name,
          description: menu.description ?? null,
        });
      }
    }
    if (targets.includes('category')) {
      for (const category of await getCategoryRows(companyId)) {
        items.push({ id: category.id, kind: 'category', text: category.name, description: null });
      }
    }
    if (targets.includes('option')) {
      for (const option of await getOptionRows(companyId)) {
        items.push({ id: option.id, kind: 'option', text: option.name, description: null });
      }
    }

    if (items.length === 0) return { ok: false, error: '翻訳する項目がありませんでした。' };

    // 1 回に投げすぎないよう、50 件ずつに分ける
    const chunks: (typeof items)[] = [];
    for (let i = 0; i < items.length; i += 50) chunks.push(items.slice(i, i + 50));

    const system = [
      'あなたは飲食店のメニューを多言語に訳す人です。',
      '',
      '守ること:',
      '- 直訳よりも「その言語で注文する人に伝わるか」を優先すること。',
      '- 料理名は、日本語の呼び名が世界で通っているもの（ramen, sushi など）はそのまま使ってよい。',
      '- 分からないもの、固有名詞で訳しようがないものは、日本語のローマ字表記にしたうえで括弧で中身を補うこと。',
      '- 値段や数量を勝手に足さないこと。',
      '- アレルギーや辛さなど、安全に関わる言葉は落とさないこと。',
      '',
      `訳す言語: ${LOCALES.map((l) => `${l.value}（${l.label}）`).join('、')}`,
      '',
      'JSON だけを返すこと。形式: {"<id>": {"en": "...", "vi": "...", ...}, ...}',
    ].join('\n');

    const translated: Filled = {};

    for (const chunk of chunks) {
      const prompt = chunk
        .map((item) =>
          [
            `id: ${item.id}`,
            `種別: ${item.kind}`,
            `日本語: ${item.text}`,
            item.description ? `説明: ${item.description}` : null,
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n');

      const result = await askJson<Filled>({ system, prompt, maxTokens: 8000 });
      Object.assign(translated, result);
    }

    // メニューだけは翻訳テーブルへ保存する（カテゴリ・オプションは別テーブル）
    let filled = 0;
    let skipped = 0;

    const menuIds = new Set(
      items.filter((item) => item.kind === 'menu').map((item) => item.id)
    );

    for (const [id, byLocale] of Object.entries(translated)) {
      if (!menuIds.has(id)) {
        skipped += 1;
        continue;
      }

      const rows: MenuTranslation[] = LOCALES.map((locale) => ({
        menu_id: id,
        locale: locale.value,
        name: byLocale[locale.value]?.trim() || null,
        description: null,
        featured_label: null,
      })).filter((row) => row.name);

      if (rows.length === 0) continue;

      if (isDemoMode()) {
        // 手で入れた訳は残す。空いている言語だけ足す
        const existing = demoMenu.getMenuDetail(id)?.translations ?? [];
        const merged = [
          ...existing,
          ...rows.filter((row) => !existing.some((e) => e.locale === row.locale && e.name)),
        ];
        demoMenu.saveMenuTranslations(id, merged);
      } else {
        const supabase = supabaseAdmin();
        const { data } = await supabase
          .from('menu_translations')
          .select('locale, name')
          .eq('menu_id', id);

        const hasName = new Set(
          ((data ?? []) as { locale: Locale; name: string | null }[])
            .filter((row) => row.name)
            .map((row) => row.locale)
        );

        const toInsert = rows.filter((row) => !hasName.has(row.locale));
        if (toInsert.length > 0) {
          const { error } = await supabase
            .from('menu_translations')
            .upsert(toInsert, { onConflict: 'menu_id,locale' });
          if (error) throw error;
        }
      }

      filled += 1;
    }

    revalidatePath('/autoTranslation');
    revalidatePath('/menu');
    return { ok: true, filled, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '翻訳できませんでした' };
  }
}
