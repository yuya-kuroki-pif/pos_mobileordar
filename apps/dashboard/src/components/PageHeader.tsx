'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Breadcrumb, Button, Flex, Space, Tag, Typography } from 'antd';
import Link from 'next/link';

import { useT } from './LocaleProvider';

/**
 * ページ共通の見出し（仕様書 §11 の PageHeader）。
 * パンくず → タイトル（戻る矢印つき）→ 右上アクション の順に並べる。
 */
export function PageHeader({
  title,
  description,
  backTo,
  breadcrumb,
  tags,
  extra,
}: {
  title: string;
  description?: string;
  backTo?: string;
  breadcrumb?: { label: string; href?: string }[];
  /** 「取扱店舗」など、タイトル横に添えるタグ */
  tags?: string[];
  extra?: React.ReactNode;
}) {
  // 訳が用意されていない文字列は日本語のまま出す
  const t = useT();

  return (
    <div style={{ marginBottom: 20 }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 8, fontSize: 13 }}
          items={breadcrumb.map((crumb) => ({
            title: crumb.href ? <Link href={crumb.href}>{t(crumb.label)}</Link> : t(crumb.label),
          }))}
        />
      )}

      <Flex align="flex-start" justify="space-between" gap={16} wrap>
        <div style={{ minWidth: 0 }}>
          <Space align="center" size={8}>
            {backTo && (
              <Link href={backTo} aria-label="戻る">
                <Button type="text" size="small" icon={<ArrowLeftOutlined />} />
              </Link>
            )}
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t(title)}
            </Typography.Title>
            {tags?.map((tag) => (
              <Tag key={tag} color="blue">
                {t(tag)}
              </Tag>
            ))}
          </Space>
          {description && (
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
              {t(description)}
            </Typography.Text>
          )}
        </div>

        {extra && <Space wrap>{extra}</Space>}
      </Flex>
    </div>
  );
}
