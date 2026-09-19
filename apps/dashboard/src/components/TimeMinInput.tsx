'use client';

import { Input } from 'antd';
import { useEffect, useState } from 'react';

import { labelToMin, minToLabel } from '@/lib/time';

/**
 * HH:MM の入力欄（仕様書 §5.12）。
 *
 * antd の TimePicker は 24:00 以降を扱えないため、深夜営業（31:00 ＝ 翌 7:00）を
 * そのまま書けるように文字列で受けて、0:00 からの分に直す。
 * Form.Item から value / onChange を受け取る。
 */
export function TimeMinInput({
  value,
  onChange,
  disabled,
  placeholder = '17:00',
}: {
  value?: number | null;
  onChange?: (value: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  // 打っている途中は不正な文字列になるので、表示用の文字列を別に持つ
  const [text, setText] = useState(() => minToLabel(value));

  useEffect(() => {
    setText(minToLabel(value));
  }, [value]);

  return (
    <Input
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      style={{ width: '100%' }}
      status={text !== '' && labelToMin(text) === null ? 'error' : undefined}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (next.trim() === '') onChange?.(null);
        else {
          const min = labelToMin(next);
          if (min !== null) onChange?.(min);
        }
      }}
      onBlur={() => setText(minToLabel(value))}
    />
  );
}
