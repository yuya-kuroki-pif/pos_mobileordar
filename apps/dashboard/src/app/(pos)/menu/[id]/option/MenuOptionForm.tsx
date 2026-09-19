'use client';

import { App, Button, Card, Empty, List, Select, Space, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setMenuOptionsAction } from '@/lib/actions/menu';
import type { OptionRow } from '@/lib/types';

const yen = new Intl.NumberFormat('ja-JP');

/**
 * オプションタブ（仕様書 §5.3）。
 * 既存のオプションを選んで紐付ける。オプション自体の中身は
 * オプション編集画面（§5.5）で作る。
 */
export function MenuOptionForm({
  menuId,
  options,
  selectedIds,
  editable,
}: {
  menuId: string;
  options: OptionRow[];
  selectedIds: string[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [pending, startTransition] = useTransition();

  const dirty =
    selected.length !== selectedIds.length || selected.some((id) => !selectedIds.includes(id));

  function save() {
    startTransition(async () => {
      const result = await setMenuOptionsAction(menuId, selected);
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      router.refresh();
    });
  }

  const attached = selected
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is OptionRow => Boolean(o));

  return (
    <>
      <Card title="紐付けるオプション" style={{ marginTop: 16 }}>
        <Select
          mode="multiple"
          allowClear
          disabled={!editable}
          style={{ width: '100%' }}
          placeholder="オプションを選んでください"
          value={selected}
          onChange={setSelected}
          options={options.map((o) => ({ value: o.id, label: o.name }))}
        />

        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
          オプション自体の作成・編集は <Link href="/option">オプション一覧</Link> から行います。
        </Typography.Paragraph>

        {attached.length === 0 ? (
          <Empty description="オプションは紐付いていません" style={{ margin: '24px 0' }} />
        ) : (
          <List
            style={{ marginTop: 16 }}
            dataSource={attached}
            renderItem={(option) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space size={6}>
                      {option.name}
                      {option.min_choice > 0 && <Tag color="red">必須</Tag>}
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {option.min_choice} 〜 {option.max_choice} 個選択
                      </Typography.Text>
                    </Space>
                  }
                  description={
                    <Space size={4} wrap>
                      {option.choices.map((choice) => (
                        <Tag key={choice.id} color={choice.is_default ? 'blue' : undefined}>
                          {choice.name}
                          {choice.price !== 0 && ` +${yen.format(choice.price)}円`}
                        </Tag>
                      ))}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#f5f5f5',
          padding: '16px 0',
          marginTop: 16,
          textAlign: 'right',
        }}
      >
        <Space>
          <Button onClick={() => setSelected(selectedIds)} disabled={!dirty || pending}>
            変更を破棄
          </Button>
          <Button type="primary" onClick={save} disabled={!editable || !dirty} loading={pending}>
            保 存
          </Button>
        </Space>
      </div>
    </>
  );
}
