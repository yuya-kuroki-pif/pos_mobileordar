'use client';

import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useActionState } from 'react';

import { loginAction, type LoginState } from '@/lib/actions/session';
import { HEADER_BG } from '@/styles/theme';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: HEADER_BG,
        padding: 16,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Typography.Title level={4} style={{ marginTop: 0, textAlign: 'center' }}>
          管理ダッシュボード
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 13 }}>
          アカウントのメールアドレスでログインしてください
        </Typography.Paragraph>

        <form action={formAction}>
          <Form layout="vertical" component={false}>
            <Form.Item label="メールアドレス" style={{ marginBottom: 16 }}>
              <Input
                name="email"
                type="email"
                autoComplete="username"
                defaultValue="owner@example.com"
                size="large"
                required
              />
            </Form.Item>

            <Form.Item label="パスワード" style={{ marginBottom: 16 }}>
              <Input.Password name="password" autoComplete="current-password" size="large" required />
            </Form.Item>

            {state.error && (
              <Alert type="error" message={state.error} showIcon style={{ marginBottom: 16 }} />
            )}

            <Button type="primary" htmlType="submit" size="large" block loading={pending}>
              ログイン
            </Button>
          </Form>
        </form>

        <Typography.Paragraph
          type="secondary"
          style={{ textAlign: 'center', fontSize: 12, marginTop: 16, marginBottom: 0 }}
        >
          デモの初期値は <code>owner@example.com</code> / <code>demo1234</code>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
