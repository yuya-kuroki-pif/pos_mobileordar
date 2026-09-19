'use client';

import { App, Button, Card, Flex, Input, Popconfirm, Tag, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setShopPasswordAction } from '@/lib/actions/shop';
import type { Shop, ShopPasswordKind } from '@/lib/types';

const KINDS: { key: ShopPasswordKind; label: string; description: string }[] = [
  {
    key: 'drawer_open',
    label: 'ドロワーオープン',
    description: '会計以外でドロワーを開くときに聞きます',
  },
  { key: 'void', label: 'VOID', description: '会計を取り消すときに聞きます' },
  {
    key: 'table_clear',
    label: 'テーブルクリア',
    description: '会計せずに卓を空けるときに聞きます',
  },
];

/**
 * レジ操作用パスワード（仕様書 §5.12）。
 * 保存するのはハッシュだけで、設定済みかどうかしか画面には出さない。
 */
export function ShopPasswordCard({ shop, editable }: { shop: Shop; editable: boolean }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKind, setSavingKind] = useState<ShopPasswordKind | null>(null);
  const [, startTransition] = useTransition();

  const isSet: Record<ShopPasswordKind, boolean> = {
    drawer_open: shop.has_drawer_open_password,
    void: shop.has_void_password,
    table_clear: shop.has_table_clear_password,
  };

  function save(kind: ShopPasswordKind, password: string | null) {
    setSavingKind(kind);
    startTransition(async () => {
      const result = await setShopPasswordAction(shop.id, kind, password);
      setSavingKind(null);
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      setDrafts((current) => ({ ...current, [kind]: '' }));
      message.success(password === null ? '解除しました' : '設定しました');
      router.refresh();
    });
  }

  return (
    <Card title="パスワード設定" style={{ marginTop: 16 }}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        英数字 4 文字以上。設定した値はハッシュ化して保存するため、あとから確認できません。
      </Typography.Paragraph>

      {KINDS.map((kind) => (
        <div key={kind.key} style={{ marginBottom: 16 }}>
          <Flex gap={8} align="center" wrap style={{ marginBottom: 4 }}>
            <span style={{ width: 150 }}>{kind.label}</span>
            {isSet[kind.key] ? <Tag color="blue">設定済み</Tag> : <Tag>未設定</Tag>}
          </Flex>

          <Flex gap={8} align="center" wrap>
            <Input.Password
              value={drafts[kind.key] ?? ''}
              disabled={!editable}
              placeholder={isSet[kind.key] ? '変更する場合のみ入力' : '英数字 4 文字以上'}
              style={{ width: 260 }}
              onChange={(e) => setDrafts((current) => ({ ...current, [kind.key]: e.target.value }))}
            />
            <Button
              disabled={!editable || !(drafts[kind.key] ?? '').trim()}
              loading={savingKind === kind.key}
              onClick={() => save(kind.key, drafts[kind.key])}
            >
              設定
            </Button>
            {isSet[kind.key] && (
              <Popconfirm
                title={`${kind.label}のパスワードを解除しますか？`}
                onConfirm={() => save(kind.key, null)}
                disabled={!editable}
              >
                <Button danger type="text" disabled={!editable}>
                  解除
                </Button>
              </Popconfirm>
            )}
          </Flex>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {kind.description}
          </Typography.Text>
        </div>
      ))}
    </Card>
  );
}
