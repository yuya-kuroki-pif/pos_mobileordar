'use client';

import { TranslationOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Checkbox, Form, Space, Switch, Typography } from 'antd';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { translateMenusAction } from '@/lib/actions/translate';

import { PageHeader } from '@/components/PageHeader';
import { saveAutoTranslationAction } from '@/lib/actions/companySettings';
import { LOCALES, type AutoTranslationSetting } from '@/lib/types';

const TARGETS: { key: keyof AutoTranslationSetting; label: string }[] = [
  { key: 'target_menu', label: 'メニュー' },
  { key: 'target_plan', label: 'プラン' },
  { key: 'target_option', label: 'オプション・プランオプション' },
  { key: 'target_category', label: 'カテゴリ' },
  { key: 'target_recommendation', label: 'おすすめメニュー' },
];

/** 自動翻訳設定（仕様書 §5.9） */
export function AutoTranslationForm({
  setting,
  companyName,
  editable,
  aiReady,
}: {
  setting: AutoTranslationSetting;
  companyName: string;
  editable: boolean;
  aiReady: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();

  const [runTargets, setRunTargets] = useState<('menu' | 'category' | 'option')[]>(['menu']);
  const [translating, setTranslating] = useState(false);
  const [translateNote, setTranslateNote] = useState<string | null>(null);

  function runTranslate() {
    setTranslating(true);
    setTranslateNote(null);
    startTransition(async () => {
      const result = await translateMenusAction(runTargets);
      setTranslating(false);
      if (!result.ok) {
        message.error(result.error ?? '翻訳できませんでした');
        return;
      }
      setTranslateNote(`${result.filled ?? 0} 件のメニューに訳を入れました。`);
      router.refresh();
    });
  }

  function submit() {
    form.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveAutoTranslationAction(values);
        if (!result.ok) {
          message.error(result.error ?? '保存できませんでした');
          return;
        }
        message.success('保存しました');
        router.refresh();
      });
    });
  }

  return (
    <>
      <PageHeader
        title="自動翻訳設定"
        description="日本語で書いた名前と説明文を、毎朝まとめて翻訳します"
        breadcrumb={[{ label: companyName }, { label: '業態管理' }, { label: '自動翻訳設定' }]}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="毎朝 5 時に、前日までに変わった文章だけを翻訳します"
        description={`対応言語: ${LOCALES.map((l) => l.label).join(' / ')}。手で入れた訳がある項目は上書きしません。`}
      />

      <Form
        form={form}
        layout="vertical"
        disabled={!editable}
        initialValues={{
          is_enabled: setting.is_enabled,
          target_menu: setting.target_menu,
          target_plan: setting.target_plan,
          target_option: setting.target_option,
          target_category: setting.target_category,
          target_recommendation: setting.target_recommendation,
        }}
      >
        <Card title="自動翻訳">
          <Form.Item name="is_enabled" label="自動翻訳を使う" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            翻訳する箇所
          </Typography.Text>

          {TARGETS.map((target) => (
            <Form.Item key={target.key} name={target.key} label={target.label} valuePropName="checked">
              <Switch />
            </Form.Item>
          ))}
        </Card>

        <Card title="いますぐ翻訳する" style={{ marginTop: 16 }}>
          {aiReady ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="secondary">
                訳が空いている項目だけを埋めます。手で入れた訳は上書きしません。
              </Typography.Text>
              <Space wrap>
                <Checkbox.Group
                  value={runTargets}
                  onChange={(value) => setRunTargets(value as typeof runTargets)}
                  options={[
                    { value: 'menu', label: 'メニュー' },
                    { value: 'category', label: 'カテゴリ' },
                    { value: 'option', label: 'オプション' },
                  ]}
                  disabled={!editable}
                />
                <Button
                  icon={<TranslationOutlined />}
                  onClick={runTranslate}
                  loading={translating}
                  disabled={!editable || runTargets.length === 0}
                >
                  翻訳する
                </Button>
              </Space>
              {translateNote && <Alert type="success" showIcon message={translateNote} />}
            </Space>
          ) : (
            <Alert
              type="warning"
              showIcon
              message="AI の接続先が未設定です"
              description="ANTHROPIC_API_KEY を .env.local に設定すると、この画面から翻訳をまとめて作れます。設定は今でも保存できます。"
            />
          )}
        </Card>

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="毎朝の自動実行はまだ動いていません"
          description="上のスイッチは設定として保存されますが、定時に走らせる仕組み（cron）はこれからです。いまは「翻訳する」を押したときだけ動きます。"
        />

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button type="primary" onClick={submit} loading={pending} disabled={!editable}>
              更 新
            </Button>
          </Space>
        </div>
      </Form>
    </>
  );
}
