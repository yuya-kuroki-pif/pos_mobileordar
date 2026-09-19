'use client';

import { Alert, App, Modal, Select, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { copyShopMenusAction } from '@/lib/actions/menu';
import type { Shop } from '@/lib/types';

/**
 * 他店舗の取扱一括設定（仕様書 §5.13）。
 * いま開いている店舗の取扱設定を、同じ業態の別店舗へ写す。
 */
export function CopyShopMenuModal({
  open,
  sourceShop,
  shops,
  onClose,
}: {
  open: boolean;
  sourceShop: Shop;
  shops: Shop[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const targets = shops.filter((shop) => shop.id !== sourceShop.id);

  function submit() {
    if (targetIds.length === 0) {
      message.warning('コピー先の店舗を選んでください。');
      return;
    }

    startTransition(async () => {
      const result = await copyShopMenusAction(sourceShop.id, targetIds);
      if (!result.ok) {
        message.error(result.error ?? 'コピーできませんでした');
        return;
      }
      message.success(`${targetIds.length} 店舗へコピーしました`);
      setTargetIds([]);
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      title="他店舗の取扱一括設定"
      okText="コピー"
      cancelText="キャンセル"
      confirmLoading={pending}
      onOk={submit}
      onCancel={onClose}
    >
      <Typography.Paragraph>
        <Typography.Text strong>{sourceShop.name}</Typography.Text>
        {' の取扱設定を、選んだ店舗へ写します。'}
      </Typography.Paragraph>

      <Select
        mode="multiple"
        allowClear
        style={{ width: '100%' }}
        placeholder="コピー先の店舗"
        value={targetIds}
        onChange={setTargetIds}
        options={targets.map((shop) => ({ value: shop.id, label: shop.name }))}
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginTop: 16 }}
        message="コピー先の取扱設定は上書きされます"
        description="キッチンプリンターとデシャップグループは店舗ごとの設定なので、コピーせず未設定のままにします。"
      />
    </Modal>
  );
}
