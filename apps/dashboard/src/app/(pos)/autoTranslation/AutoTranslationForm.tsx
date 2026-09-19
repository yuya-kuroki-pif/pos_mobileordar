'use client';

import { Alert, App, Button, Card, Form, Space, Switch, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

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
}: {
  setting: AutoTranslationSetting;
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();

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

        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
          message="翻訳エンジンの接続は未実装です"
          description="ここでの設定は保存されますが、実際に文章を翻訳するバッチ（DeepL / Gemini）はまだ動いていません。"
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
