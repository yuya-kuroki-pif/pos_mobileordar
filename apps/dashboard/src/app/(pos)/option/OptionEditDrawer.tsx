'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Col,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { saveOptionAction, type OptionFormInput } from '@/lib/actions/option';
import type { Choice, MenuRow, OptionRow } from '@/lib/types';

/** 保存時にサーバー側で作り直すので、新規行の id は画面内の一時キー */
function newChoice(): Choice {
  return {
    id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
    option_id: '',
    name: '',
    receipt_display_name: null,
    price: 0,
    is_default: false,
    is_available: true,
    display_order: 0,
  };
}

/** オプションの編集（仕様書 §5.5）。一覧の横からドロワーで開く */
export function OptionEditDrawer({
  option,
  menus,
  open,
  onClose,
}: {
  /** null なら新規作成 */
  option: OptionRow | null;
  menus: MenuRow[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [choices, setChoices] = useState<Choice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 同じドロワーを使い回すので、開くたびに中身を入れ替える
  useEffect(() => {
    if (!open) return;
    setError(null);
    setChoices(option ? option.choices.map((c) => ({ ...c })) : [newChoice()]);
    form.setFieldsValue({
      name: option?.name ?? '',
      receipt_display_name: option?.receipt_display_name ?? '',
      min_choice: option?.min_choice ?? 0,
      max_choice: option?.max_choice ?? 1,
      display_order: option?.display_order ?? 0,
      menuIds: option?.menu_ids ?? [],
    });
  }, [open, option, form]);

  function patchChoice(id: string, change: Partial<Choice>) {
    setChoices((current) => current.map((c) => (c.id === id ? { ...c, ...change } : c)));
  }

  function submit() {
    setError(null);
    form
      .validateFields()
      .then((values) => {
        const input: OptionFormInput = {
          id: option?.id ?? '',
          name: values.name,
          receipt_display_name: values.receipt_display_name ?? '',
          min_choice: values.min_choice ?? 0,
          max_choice: values.max_choice ?? 1,
          display_order: values.display_order ?? 0,
          choices,
          menuIds: values.menuIds ?? [],
        };

        startTransition(async () => {
          const result = await saveOptionAction(input);
          if (!result.ok) {
            setError(result.error ?? '保存できませんでした');
            return;
          }
          message.success('保存しました');
          onClose();
          router.refresh();
        });
      })
      .catch(() => {
        /* 入力エラーは Form が表示する */
      });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={620}
      title={option ? 'オプションを編集' : 'オプションを新規作成'}
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>キャンセル</Button>
          <Button type="primary" onClick={submit} loading={pending}>
            {option ? '更 新' : '作 成'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="オプション名"
          rules={[{ required: true, message: 'オプション名を入力してください' }]}
        >
          <Input placeholder="例: 焼き加減" />
        </Form.Item>

        <Form.Item
          name="receipt_display_name"
          label="伝票表示名"
          extra="空欄ならオプション名を使います"
        >
          <Input />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={12} sm={8}>
            <Form.Item name="min_choice" label="最小選択数" extra="1 以上にすると必須になります">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="max_choice" label="最大選択数">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="display_order" label="表示順">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          選択肢
        </Typography.Text>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          金額は本体価格への加算です（0 円なら加算なし）。
        </Typography.Paragraph>

        {choices.map((choice) => (
          <Flex key={choice.id} gap={8} align="center" wrap style={{ marginBottom: 8 }}>
            <Input
              value={choice.name}
              placeholder="例: レア"
              style={{ width: 180 }}
              onChange={(e) => patchChoice(choice.id, { name: e.target.value })}
            />
            <InputNumber
              prefix="¥"
              value={choice.price}
              style={{ width: 130 }}
              onChange={(value) => patchChoice(choice.id, { price: value ?? 0 })}
            />
            <Checkbox
              checked={choice.is_default}
              onChange={(e) => patchChoice(choice.id, { is_default: e.target.checked })}
            >
              既定
            </Checkbox>
            <Checkbox
              checked={choice.is_available}
              onChange={(e) => patchChoice(choice.id, { is_available: e.target.checked })}
            >
              販売中
            </Checkbox>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={choices.length <= 1}
              onClick={() => setChoices((c) => c.filter((x) => x.id !== choice.id))}
            />
          </Flex>
        ))}

        <Button
          size="small"
          icon={<PlusOutlined />}
          style={{ marginBottom: 24 }}
          onClick={() => setChoices((c) => [...c, newChoice()])}
        >
          選択肢を追加
        </Button>

        <Form.Item name="menuIds" label="このオプションを付けるメニュー">
          <Select
            mode="multiple"
            allowClear
            optionFilterProp="label"
            placeholder="メニューを選択"
            options={menus.map((menu) => ({
              value: menu.id,
              label: menu.name,
            }))}
          />
        </Form.Item>
      </Form>

      {error && <Alert type="error" showIcon message={error} />}
    </Drawer>
  );
}
