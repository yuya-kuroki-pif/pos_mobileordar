'use client';

import { Alert, App, Button, Card, Descriptions, Input, Space, Table } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveMenuTranslationsAction } from '@/lib/actions/menu';
import { LOCALES, type Locale, type Menu, type MenuTranslation } from '@/lib/types';

interface Draft {
  locale: Locale;
  name: string;
  description: string;
  featured_label: string;
}

/**
 * 多言語設定タブ（仕様書 §5.3）。
 * 原文を上に出し、6 言語ぶんの入力欄を並べる。
 */
export function MenuTranslationForm({
  menuId,
  menu,
  translations,
  editable,
}: {
  menuId: string;
  menu: Menu;
  translations: MenuTranslation[];
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();

  const initial: Draft[] = LOCALES.map(({ value }) => {
    const row = translations.find((t) => t.locale === value);
    return {
      locale: value,
      name: row?.name ?? '',
      description: row?.description ?? '',
      featured_label: row?.featured_label ?? '',
    };
  });

  const [drafts, setDrafts] = useState<Draft[]>(initial);

  const dirty = drafts.some((draft, i) => {
    const base = initial[i];
    return (
      draft.name !== base.name ||
      draft.description !== base.description ||
      draft.featured_label !== base.featured_label
    );
  });

  function change(locale: Locale, field: keyof Omit<Draft, 'locale'>, value: string) {
    setDrafts((current) =>
      current.map((draft) => (draft.locale === locale ? { ...draft, [field]: value } : draft))
    );
  }

  function save() {
    startTransition(async () => {
      const result = await saveMenuTranslationsAction(menuId, drafts);
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      router.refresh();
    });
  }

  return (
    <>
      <Card title="原文（日本語）" style={{ marginTop: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="メニュー名">{menu.name}</Descriptions.Item>
          <Descriptions.Item label="説明文">{menu.description ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="特集ラベル">{menu.featured_label ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Alert
        type="info"
        showIcon
        message="自動翻訳は未実装です"
        description="仕様書 §5.9 の自動翻訳（DeepL / Gemini で毎朝 5 時に実行）は、API キーの用意と合わせて実装します。ここでは手入力のみです。"
        style={{ marginTop: 16 }}
      />

      <Card style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
        <Table<Draft>
          rowKey="locale"
          dataSource={drafts}
          size="middle"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: '言語',
              dataIndex: 'locale',
              width: 160,
              fixed: 'left',
              render: (value: Locale) => LOCALES.find((l) => l.value === value)?.label ?? value,
            },
            {
              title: 'メニュー名',
              dataIndex: 'name',
              width: 220,
              render: (value: string, row) => (
                <Input
                  value={value}
                  disabled={!editable}
                  onChange={(e) => change(row.locale, 'name', e.target.value)}
                />
              ),
            },
            {
              title: '説明文',
              dataIndex: 'description',
              width: 320,
              render: (value: string, row) => (
                <Input.TextArea
                  value={value}
                  rows={2}
                  disabled={!editable}
                  onChange={(e) => change(row.locale, 'description', e.target.value)}
                />
              ),
            },
            {
              title: '特集ラベル',
              dataIndex: 'featured_label',
              width: 180,
              render: (value: string, row) => (
                <Input
                  value={value}
                  disabled={!editable}
                  onChange={(e) => change(row.locale, 'featured_label', e.target.value)}
                />
              ),
            },
          ]}
        />
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
          <Button onClick={() => setDrafts(initial)} disabled={!dirty || pending}>
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
