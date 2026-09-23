import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * お客様側のセッション。
 *
 * スタッフ用（lib/auth.ts）と同じく HMAC 署名付きの Cookie に入れる。
 * 中身は顧客 ID だけで、個人情報は入れない。
 * 卓を離れても次回の来店で引き継げるよう、有効期限は長めにとる。
 */

const COOKIE_NAME = 'mo_guest';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 日

export interface GuestSession {
  customerId: string;
  issuedAt: number;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error('SESSION_SECRET が未設定です。');
  }
  return value;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export async function setGuestSession(customerId: string): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({ customerId, issuedAt: Math.floor(Date.now() / 1000) })
  ).toString('base64url');

  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getGuestSession(): Promise<GuestSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  // 署名の突き合わせは時間差が出ないように比較する
  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as GuestSession;
  } catch {
    return null;
  }
}

export async function clearGuestSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/** 連携をあとにしたお客様に、同じ卓で何度も出さないための印 */
const SKIP_COOKIE = 'mo_guest_skip';

export async function markConnectSkipped(token: string): Promise<void> {
  (await cookies()).set(`${SKIP_COOKIE}_${token}`, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 6, // その食事の間だけ
  });
}

export async function hasSkippedConnect(token: string): Promise<boolean> {
  return (await cookies()).get(`${SKIP_COOKIE}_${token}`)?.value === '1';
}
