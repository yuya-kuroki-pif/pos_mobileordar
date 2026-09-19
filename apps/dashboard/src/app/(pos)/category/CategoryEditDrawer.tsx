'use client';

import {
  Alert,
  App,
  Button,
  ColorPicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { saveCategoryAction, type CategoryFormInput } from '@/lib/actions/category';
import type { CategoryRow, MenuRow } from '@/lib/types';

/**
 * カテゴリの編集（仕様書 §5.6）。
 * 項目が少ないので、一覧の横からドロワーで開く。
 */
export function CategoryEditDrawer({
  category,
  menus,
  open,
  onClose,
}: {
  /** null なら新規作成 */
  category: CategoryRow | null;
  menus: MenuRow[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 同じドロワーを使い回すので、開くたびに中身を入れ替える
  useEffect(() => {
    if (!open) return;
    setError(null);
    form.setFieldsValue({
      name: category?.name ?? '',
      staff_display_name: category?.staff_display_name ?? '',
      description: category?.description ?? '',
      handy_bg_color: category?.handy_bg_color ?? '',
      kds_color: category?.kds_color ?? '',
      display_order: category?.display_order ?? 0,
      is_active: category?.is_active ?? true,
      menuIds: category?.menu_ids ?? [],
    });
  }, [open, category, form]);

  function submit() {
    setError(null);
    form
      .validateFields()
      .then((values) => {
        const input: CategoryFormInput = {
          id: category?.id ?? '',
          name: values.name,
          staff_display_name: values.staff_display_name ?? '',
          description: values.description ?? '',
          handy_bg_color: values.handy_bg_color?.trim() || null,
          kds_color: values.kds_color?.trim() || null,
          display_order: values.display_order ?? 0,
          is_active: values.is_active ?? true,
          menuIds: values.menuIds ?? [],
        };

        startTransition(async () => {
          const result = await saveCategoryAction(input);
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
      width={520}
      title={category ? 'カテゴリを編集' : 'カテゴリを新規作成'}
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>キャンセル</Button>
          <Button type="primary" onClick={submit} loading={pending}>
            {category ? '更 新' : '作 成'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="カテゴリ名"
          rules={[{ required: true, message: 'カテゴリ名を入力してください' }]}
        >
          <Input placeholder="例: 串焼き" />
        </Form.Item>

        <Form.Item name="staff_display_name" label="スタッフ表示名" extra="ハンディに出す短い名前">
          <Input />
        </Form.Item>

        <Form.Item name="description" label="説明文">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Form.Item name="handy_bg_color" label="ハンディ背景色" extra="#RRGGBB。空欄なら色分けなし">
          <ColorInput />
        </Form.Item>

        <Form.Item
          name="kds_color"
          label="キッチンディスプレイの色"
          extra="#RRGGBB。空欄なら色分けなし"
        >
          <ColorInput />
        </Form.Item>

        <Form.Item name="display_order" label="表示順" extra="小さいほど先頭">
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="is_active"
          label="有効"
          valuePropName="checked"
          extra="OFF にすると端末のメニューから消えます"
        >
          <Switch />
        </Form.Item>

        <Form.Item name="menuIds" label="このカテゴリに入れるメニュー">
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

/** 色見本つきのテキスト入力。Form.Item から value / onChange を受け取る */
function ColorInput({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  return (
    <Space.Compact style={{ width: '100%' }}>
      <ColorPicker
        value={value || '#ffffff'}
        onChange={(color) => onChange?.(color.toHexString())}
      />
      <Input
        value={value ?? ''}
        placeholder="#f5f5f5"
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Space.Compact>
  );
}
