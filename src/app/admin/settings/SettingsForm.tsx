'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { changePin, saveStoreSettings } from '@/lib/actions/admin';
import type { Store } from '@/lib/types';

export function SettingsForm({ store }: { store: Store }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinPending, startPinTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveStoreSettings(formData);
      if (result.ok) {
        setMessage('保存しました');
        router.refresh();
      } else {
        setError(result.error ?? '保存できませんでした');
      }
    });
  }

  function submitPin(formData: FormData) {
    setPinMessage(null);
    setPinError(null);
    startPinTransition(async () => {
      const result = await changePin(formData);
      if (result.ok) setPinMessage('PIN を変更しました。次回のログインから有効です。');
      else setPinError(result.error ?? '変更できませんでした');
    });
  }

  return (
    <>
      <PageHeader title="店舗設定" description="税率やサービス料、モバイルオーダーの受付設定。" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-5 font-bold">基本設定</h2>

          <form action={submit} className="space-y-5">
            <Field label="店舗名">
              <Input name="name" defaultValue={store.name} required />
            </Field>

            <Field label="店舗コード" hint="ログイン時に入力するコード。変更はできません">
              <Input value={store.slug} disabled className="bg-charcoal-50 text-charcoal-400" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="消費税率（%）">
                <Input
                  name="tax_rate"
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  defaultValue={(store.tax_rate * 100).toFixed(1)}
                  className="tabular text-right"
                />
              </Field>

              <Field label="サービス料（%）" hint="不要なら 0">
                <Input
                  name="service_charge_rate"
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  defaultValue={(store.service_charge_rate * 100).toFixed(1)}
                  className="tabular text-right"
                />
              </Field>
            </div>

            <Field label="価格表示" hint="日本の飲食店は総額表示（内税）が一般的です">
              <select
                name="tax_included"
                defaultValue={store.tax_included ? 'included' : 'excluded'}
                className="w-full rounded-xl border border-charcoal-200 bg-white px-3 py-2.5 outline-none focus:border-ember-400"
              >
                <option value="included">内税（メニュー価格に消費税を含む）</option>
                <option value="excluded">外税（会計時に消費税を加算）</option>
              </select>
            </Field>

            <Field
              label="営業日の区切り時刻"
              hint="深夜営業の売上を前日として集計します。0 にすると暦日どおり"
            >
              <Input
                name="cutoff"
                type="number"
                min={0}
                max={12}
                defaultValue={store.business_day_cutoff_hour}
                className="tabular text-right"
              />
            </Field>

            <Field label="来店時のお知らせ" hint="モバイルオーダーの最初の画面に表示されます">
              <Input name="opening_note" defaultValue={store.opening_note ?? ''} />
            </Field>

            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                name="mobile_order_open"
                defaultChecked={store.mobile_order_open}
                className="h-5 w-5 rounded border-charcoal-300 text-ember-600 focus:ring-ember-400"
              />
              <span className="text-sm font-medium text-charcoal-700">
                モバイルオーダーを受け付ける
              </span>
            </label>

            {message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : '保存'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-2 font-bold">スタッフ PIN</h2>
            <p className="mb-5 text-sm text-charcoal-500">
              POS・キッチン・管理画面へのログインに使う暗証番号です。
              端末を共有するため、スタッフの入れ替わりがあったら変更してください。
            </p>

            <form action={submitPin} className="space-y-4">
              <Field label="新しい PIN" hint="4〜8 桁の数字">
                <Input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4,8}"
                  maxLength={8}
                  required
                  className="tabular"
                />
              </Field>

              {pinMessage && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {pinMessage}
                </p>
              )}
              {pinError && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {pinError}
                </p>
              )}

              <Button type="submit" variant="secondary" disabled={pinPending}>
                {pinPending ? '変更中…' : 'PIN を変更'}
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="mb-2 font-bold">決済について</h2>
            <p className="text-sm text-charcoal-500">
              現在の会計はすべて<strong>記録のみ</strong>です。
              カード・QR 決済は実際の決済端末で処理し、その結果をこのシステムに
              「どの支払方法で会計したか」として残す運用になります。
            </p>
            <p className="mt-3 text-sm text-charcoal-500">
              決済サービス（Stripe など）との連携は今後の拡張として設計されています。
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
