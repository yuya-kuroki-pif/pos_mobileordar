'use client';

import { Alert, Form, Input, Modal, Select } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveAccountAction } from '@/lib/actions/settings';
import type { AccountRow, Company, RbacScope, RoleDefinition, Shop } from '@/lib/types';

/** アカウントの新規作成・編集。ロールと適用範囲（全社 / 業態 / 店舗）を決める */
export function AccountModal({
  account,
  roles,
  companies,
  shops,
  onClose,
  onSaved,
}: {
  account: AccountRow | null;
  roles: RoleDefinition[];
  companies: Company[];
  shops: Shop[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [scopeType, setScopeType] = useState<RbacScope>(account?.scope_type ?? 'corporation');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 既存行はラベルしか持っていないため、名前から ID を引き直す
  const initialScopeIds = (account?.scope_labels ?? [])
    .map((label) =>
      [...companies, ...shops].find((entity) => entity.name === label)?.id
    )
    .filter((id): id is string => Boolean(id));

  const scopeOptions =
    scopeType === 'company'
      ? companies.map((c) => ({ value: c.id, label: c.name }))
      : shops.map((s) => ({ value: s.id, label: s.name }));

  function submit() {
    setError(null);
    form
      .validateFields()
      .then((values) => {
        startTransition(async () => {
          const result = await saveAccountAction({
            id: account?.id ?? '',
            email: values.email,
            name: values.name,
            roleId: values.roleId,
            scopeType: values.scopeType,
            scopeIds: values.scopeType === 'corporation' ? [] : (values.scopeIds ?? []),
          });

          if (!result.ok) {
            setError(result.error ?? '保存できませんでした');
            return;
          }
          onSaved();
          router.refresh();
        });
      })
      .catch(() => {
        /* 入力エラーは Form が表示する */
      });
  }

  return (
    <Modal
      open
      title={account ? 'アカウントを編集' : 'アカウントを作成'}
      okText={account ? '更 新' : '作 成'}
      cancelText="キャンセル"
      onCancel={onClose}
      onOk={submit}
      confirmLoading={pending}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
        initialValues={{
          name: account?.name ?? '',
          email: account?.email ?? '',
          roleId: roles.find((r) => r.name === account?.role_name)?.id ?? roles[0]?.id,
          scopeType: account?.scope_type ?? 'corporation',
          scopeIds: initialScopeIds,
        }}
      >
        <Form.Item name="name" label="氏名" rules={[{ required: true, message: '氏名を入力してください' }]}>
          <Input />
        </Form.Item>

        <Form.Item
          name="email"
          label="メールアドレス"
          rules={[
            { required: true, message: 'メールアドレスを入力してください' },
            { type: 'email', message: 'メールアドレスの形式が正しくありません' },
          ]}
        >
          <Input type="email" />
        </Form.Item>

        <Form.Item name="roleId" label="ロール" rules={[{ required: true }]}>
          <Select options={roles.map((r) => ({ value: r.id, label: r.name }))} />
        </Form.Item>

        <Form.Item name="scopeType" label="適用範囲">
          <Select
            onChange={(value: RbacScope) => {
              setScopeType(value);
              form.setFieldValue('scopeIds', []);
            }}
            options={[
              { value: 'corporation', label: '全社' },
              { value: 'company', label: '業態を指定' },
              { value: 'shop', label: '店舗を指定' },
            ]}
          />
        </Form.Item>

        {scopeType !== 'corporation' && (
          <Form.Item
            name="scopeIds"
            label={scopeType === 'company' ? '対象の業態' : '対象の店舗'}
            rules={[{ required: true, message: '1 つ以上選んでください' }]}
          >
            <Select mode="multiple" allowClear options={scopeOptions} />
          </Form.Item>
        )}

        {account && account.status === 'invited' && (
          <Alert
            type="info"
            showIcon
            message="このアカウントは招待中です"
            description="パスワードが設定されるとログインできるようになります。招待メールの送信は P0 の残作業です。"
          />
        )}

        {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}
      </Form>
    </Modal>
  );
}
