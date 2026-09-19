'use client';

import { App, Button, Card, Col, Radio, Row, Space, Tabs, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { saveMobileOrderDesignAction } from '@/lib/actions/companySettings';
import type { MobileOrderDesign, MoTheme } from '@/lib/types';

import { MoPreview } from './MoPreview';

/** モバイルオーダーデザイン設定（仕様書 §5.11） */
export function MobileOrderDesignView({
  design,
  sampleMenus,
  companyName,
  editable,
}: {
  design: MobileOrderDesign;
  sampleMenus: { id: string; name: string; price: number }[];
  companyName: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [menuTheme, setMenuTheme] = useState<MoTheme>(design.menu_theme);
  const [checkinTheme, setCheckinTheme] = useState<MoTheme>(design.checkin_theme);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveMobileOrderDesignAction({
        menu_theme: menuTheme,
        checkin_theme: checkinTheme,
      });
      if (!result.ok) {
        message.error(result.error ?? '保存できませんでした');
        return;
      }
      message.success('保存しました');
      router.refresh();
    });
  }

  function panel(theme: MoTheme, setTheme: (value: MoTheme) => void, screen: 'menu' | 'checkin') {
    return (
      <Row gutter={24}>
        <Col xs={24} md={10}>
          <Card title="背景色">
            <Radio.Group
              value={theme}
              disabled={!editable}
              onChange={(e) => setTheme(e.target.value as MoTheme)}
              options={[
                { value: 'light', label: 'ライト' },
                { value: 'dark', label: 'ダーク' },
              ]}
              optionType="button"
            />
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
              右のプレビューはお客様のスマートフォンでの見え方に近づけたものです。
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <MoPreview theme={theme} screen={screen} menus={sampleMenus} />
        </Col>
      </Row>
    );
  }

  return (
    <>
      <PageHeader
        title="モバイルオーダーデザイン設定"
        description="お客様が見る画面の配色を決めます"
        breadcrumb={[
          { label: companyName },
          { label: '業態管理' },
          { label: 'モバイルオーダーデザイン' },
        ]}
        extra={
          <Space>
            <Button type="primary" onClick={save} loading={pending} disabled={!editable}>
              更 新
            </Button>
          </Space>
        }
      />

      <Tabs
        items={[
          { key: 'menu', label: 'メニュー画面', children: panel(menuTheme, setMenuTheme, 'menu') },
          {
            key: 'checkin',
            label: 'チェックイン画面',
            children: panel(checkinTheme, setCheckinTheme, 'checkin'),
          },
        ]}
      />
    </>
  );
}
