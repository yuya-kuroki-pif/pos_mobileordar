import 'server-only';

import type { MessagingChannel } from './types';

/**
 * LINE / Zalo への送信（仕様書 §5.29 と Zalo 対応）。
 *
 * どちらも「アクセストークンを持って HTTP を叩く」だけなので、
 * 送る形はここに揃えておく。トークンが無いうちは送らず、
 * 「なぜ送れないか」を呼び出し側に返す。
 *
 * トークンは業態ごとに違うため、本来は messaging_accounts に暗号化して持たせる。
 * いまは環境変数から読むだけにしてあり、複数業態を運用する前に移す必要がある。
 */

export interface SendResult {
  ok: boolean;
  error?: string;
  sent?: number;
}

export interface OutboundMessage {
  kind: 'text' | 'image' | 'coupon' | 'questionnaire';
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
}

export function messagingToken(channel: MessagingChannel): string | null {
  const value =
    channel === 'line'
      ? process.env.LINE_CHANNEL_ACCESS_TOKEN
      : process.env.ZALO_OA_ACCESS_TOKEN;
  return value && value.trim() ? value.trim() : null;
}

export function isMessagingConfigured(channel: MessagingChannel): boolean {
  return messagingToken(channel) !== null;
}

/** LINE の push 形式へ寄せる */
function toLineMessages(messages: OutboundMessage[]): Record<string, unknown>[] {
  return messages.map((message) => {
    if (message.kind === 'image' && message.imageUrl) {
      return {
        type: 'image',
        originalContentUrl: message.imageUrl,
        previewImageUrl: message.imageUrl,
      };
    }
    const text = [message.body, message.linkUrl].filter(Boolean).join('\n');
    return { type: 'text', text: text || '(本文なし)' };
  });
}

/**
 * 1 人へ送る。一斉配信は呼び出し側で回す前提。
 * まとめ送り（multicast）は、宛先の作り方が決まってから足す。
 */
export async function sendMessage(
  channel: MessagingChannel,
  recipientId: string,
  messages: OutboundMessage[],
  options: { znsTemplateId?: string | null } = {}
): Promise<SendResult> {
  const token = messagingToken(channel);
  if (!token) {
    return {
      ok: false,
      error:
        channel === 'line'
          ? 'LINE_CHANNEL_ACCESS_TOKEN が設定されていません。'
          : 'ZALO_OA_ACCESS_TOKEN が設定されていません。',
    };
  }
  if (messages.length === 0) return { ok: false, error: '送る内容がありません。' };

  try {
    if (channel === 'line') {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: recipientId, messages: toLineMessages(messages) }),
      });

      if (!response.ok) {
        const detail = await response.text();
        return { ok: false, error: `LINE への送信に失敗しました: ${detail.slice(0, 200)}` };
      }
      return { ok: true, sent: 1 };
    }

    // Zalo はテンプレート（ZNS）が要る。自由文は友だちにしか送れない
    if (!options.znsTemplateId) {
      return { ok: false, error: 'Zalo は ZNS テンプレート ID が要ります。' };
    }

    const response = await fetch('https://business.openapi.zalo.me/message/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: token },
      body: JSON.stringify({
        phone: recipientId,
        template_id: options.znsTemplateId,
        template_data: {
          body: messages.map((message) => message.body).filter(Boolean).join('\n'),
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `Zalo への送信に失敗しました: ${detail.slice(0, 200)}` };
    }
    return { ok: true, sent: 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || '送信できませんでした' };
  }
}
