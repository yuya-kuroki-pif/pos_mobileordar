'use server';

import Anthropic from '@anthropic-ai/sdk';

import { requireSession } from '../auth';
import { runTool, TOOLS, type ToolContext } from '../agent/tools';
import type { AgentMessage, AgentResult, PlannedOp } from '../agent/types';
import { canEdit } from '../permissions';

/**
 * マスター操作のアシスタント。
 *
 * 書き込みはここでは行わない。AI は「こう変えます」という計画を返すだけで、
 * 実際に書くのは人が内容を見て実行を押したとき（applyPlanAction）。
 */

/** 既定は Sonnet 5。重い判断をさせたくなったら ANTHROPIC_MODEL で差し替える */
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const MAX_TURNS = 8;

function systemPrompt(companyName: string, shopNames: string[]): string {
  return [
    'あなたは飲食店の本部ダッシュボードに組み込まれた、メニュー登録の手伝いをするアシスタントです。',
    `いま操作している業態は「${companyName}」です。`,
    shopNames.length > 0 ? `この業態の店舗: ${shopNames.join('、')}` : 'この業態にはまだ店舗がありません。',
    '',
    '守ること:',
    '- 直接データを書き換えることはできません。plan_ で始まる道具で「計画」を積むだけです。',
    '  積んだ計画は、このあと人が内容を確かめて実行します。',
    '- 既存のメニューやカテゴリを触る前に、必ず list_ の道具で今の状態を確かめること。',
    '  思い込みで ID を書かないこと。',
    '- 価格が書かれていないメニューは、勝手に値段を決めないこと。いくらか尋ねること。',
    '- カテゴリが指定されていないときも、勝手に決めずに尋ねること。',
    '  ただし「ドリンク」「フード」の区別が名前から明らかなら、menu_type は判断してよい。',
    '- 曖昧なときは作業を進めず、短く質問すること。',
    '- オプションを新しく作るときは、選択肢とその追加料金まで揃えてから積むこと。',
    '- 「この店では出さない」は売切（sold_out）ではなく取扱設定（menu_visibility）で切ること。',
    '- 返事は日本語で、簡潔に。何を計画に積んだかが分かるように書くこと。',
    '- 計画を積んだら、最後に「内容を確かめて実行してください」と伝えること。',
  ].join('\n');
}

export async function askAssistantAction(
  history: AgentMessage[],
  question: string
): Promise<AgentResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.permissions, 'menu_master')) {
      return { ok: false, error: 'メニューマスターを編集する権限がありません。' };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        error:
          'ANTHROPIC_API_KEY が設定されていません。.env.local に API キーを入れると、この画面が使えるようになります。',
      };
    }

    const companyName =
      session.companies.find((c) => c.id === session.currentCompanyId)?.name ?? '業態';
    const shops = session.shops.filter((s) => s.company_id === session.currentCompanyId);

    const ctx: ToolContext = {
      companyId: session.currentCompanyId,
      shops,
      plan: [],
    };

    const client = new Anthropic({ apiKey });

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role, content: m.text }) as Anthropic.MessageParam),
      { role: 'user', content: question },
    ];

    let reply = '';

    // 道具を使い終えるまで往復する
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt(companyName, shops.map((s) => s.name)),
        tools: TOOLS,
        messages,
      });

      const textParts = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text);
      if (textParts.length > 0) reply = textParts.join('\n');

      const toolUses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUses.length === 0) break;

      messages.push({ role: 'assistant', content: response.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const output = await runTool(use.name, (use.input ?? {}) as Record<string, unknown>, ctx);
        results.push({ type: 'tool_result', tool_use_id: use.id, content: output });
      }

      messages.push({ role: 'user', content: results });
    }

    // 空の返答をそのまま履歴に積むと次の呼び出しが弾かれるので、必ず何か入れる
    const text = reply || '（返答がありませんでした）';

    return {
      ok: true,
      reply: text,
      plan: ctx.plan,
      history: [...history, { role: 'user', text: question }, { role: 'assistant', text }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'アシスタントを呼び出せませんでした' };
  }
}
