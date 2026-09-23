'use client';

import { DeleteOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Typography } from 'antd';
import { useRef, useState, useTransition } from 'react';

import { uploadImageAction } from '@/lib/actions/upload';

/**
 * 画像を 1 枚だけ選ばせる欄。
 * 送信は Server Action なので、ブラウザから直接ストレージへは触らない。
 */
export function ImageUpload({
  value,
  onChange,
  folder,
  hint,
  width = 180,
  height = 120,
  disabled,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  /** 保存先のフォルダ名（menu / coupon など） */
  folder: string;
  hint?: string;
  width?: number;
  height?: number;
  disabled?: boolean;
}) {
  const { message } = App.useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(value);

  function choose(file: File) {
    const data = new FormData();
    data.set('file', file);
    data.set('folder', folder);

    startTransition(async () => {
      const result = await uploadImageAction(data);
      if (!result.ok || !result.url) {
        message.error(result.error ?? '画像をアップロードできませんでした');
        return;
      }
      setPreview(result.url);
      onChange(result.url);
    });
  }

  return (
    <Flex gap={12} align="start" wrap>
      <div
        onClick={() => !disabled && !pending && inputRef.current?.click()}
        style={{
          width,
          height,
          border: '1px dashed #d9d9d9',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          overflow: 'hidden',
          background: '#fafafa',
        }}
      >
        {pending ? (
          <LoadingOutlined />
        ) : preview ? (
          // 画像の出どころがストレージにも data URL にもなるので next/image は使わない
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Flex vertical align="center" gap={4}>
            <PlusOutlined style={{ color: '#8c8c8c' }} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              画像を選ぶ
            </Typography.Text>
          </Flex>
        )}
      </div>

      <Flex vertical gap={8}>
        {hint && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {hint}
          </Typography.Text>
        )}
        {preview && (
          <Button
            size="small"
            icon={<DeleteOutlined />}
            disabled={disabled || pending}
            onClick={() => {
              setPreview(null);
              onChange(null);
            }}
          >
            画像を外す
          </Button>
        )}
      </Flex>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) choose(file);
          event.target.value = '';
        }}
      />
    </Flex>
  );
}
