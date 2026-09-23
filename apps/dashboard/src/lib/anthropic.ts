import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic の呼び出しをまとめる。
 * API キーが無くてもアプリは動く。呼ぶ側は isAiConfigured() で出し分ける。
 */

export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function anthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません。');
  return new Anthropic({ apiKey });
}

/** 文章を 1 つだけ返してほしいときの短縮形 */
export async function askText(input: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await anthropic().messages.create({
    model: AI_MODEL,
    max_tokens: input.maxTokens ?? 1500,
    system: input.system,
    messages: [{ role: 'user', content: input.prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/**
 * JSON を返してほしいとき。
 * 前後に説明が付いてくることがあるので、最初の { … } だけを取り出す。
 */
export async function askJson<T>(input: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  const text = await askText(input);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI の返答を読み取れませんでした。');
  return JSON.parse(text.slice(start, end + 1)) as T;
}
