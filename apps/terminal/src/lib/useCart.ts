'use client';

import { useCallback, useMemo, useState } from 'react';

import type { CartLine, MenuItemWithOptions, MenuOption, SelectedOption } from './types';

/**
 * 同じ商品でもオプションや備考が違えば別行として扱いたいので、
 * それらをまとめたキーで同一性を判定する。
 */
function lineKey(menuId: string, optionIds: string[], note: string): string {
  return [menuId, [...optionIds].sort().join('+'), note].join('|');
}

/** 商品 + 選択済みオプションから 1 行ぶんのカート行を作る */
export function buildCartLine(
  item: MenuItemWithOptions,
  selectedIds: string[],
  quantity: number,
  note = ''
): CartLine {
  const labels: SelectedOption[] = [];
  let optionsPrice = 0;

  for (const group of item.option_groups) {
    for (const option of group.options) {
      if (!selectedIds.includes(option.id)) continue;
      labels.push({ group: group.name, name: option.name, price_delta: option.price });
      optionsPrice += option.price;
    }
  }

  return {
    key: lineKey(item.id, selectedIds, note),
    menu_id: item.id,
    name: item.name,
    unit_price: item.price,
    quantity,
    option_ids: selectedIds,
    option_labels: labels,
    options_price: optionsPrice,
    note,
  };
}

/** カート行の小計（税込） */
export function lineTotal(line: CartLine): number {
  return (line.unit_price + line.options_price) * line.quantity;
}

/**
 * モバイルオーダーと POS の注文入力で共用するカート。
 * 送信後に空にする用途があるため clear も持つ。
 */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((line: CartLine) => {
    setLines((current) => {
      const index = current.findIndex((l) => l.key === line.key);
      if (index === -1) return [...current, line];
      // 同じ内容ならまとめて数量を足す
      const next = [...current];
      next[index] = { ...next[index], quantity: next[index].quantity + line.quantity };
      return next;
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.key !== key)
        : current.map((l) => (l.key === key ? { ...l, quantity } : l))
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((current) => current.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const total = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines]);
  const count = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  return { lines, add, setQuantity, remove, clear, total, count };
}

/**
 * オプション選択の状態管理。
 * max_select が 1 のグループはラジオ、複数可のグループはチェックボックスとして振る舞う。
 */
export function toggleOption(
  selected: string[],
  option: MenuOption,
  group: { id: string; max_choice: number },
  groupOptionIds: string[]
): string[] {
  const isSelected = selected.includes(option.id);

  if (isSelected) return selected.filter((id) => id !== option.id);

  if (group.max_choice === 1) {
    // 同じグループの他の選択肢を外してから入れ替える
    return [...selected.filter((id) => !groupOptionIds.includes(id)), option.id];
  }

  const countInGroup = selected.filter((id) => groupOptionIds.includes(id)).length;
  if (countInGroup >= group.max_choice) return selected; // 上限に達していたら無視

  return [...selected, option.id];
}

/** 必須グループがすべて満たされているか */
export function isSelectionValid(item: MenuItemWithOptions, selected: string[]): boolean {
  return item.option_groups.every((group) => {
    const ids = group.options.map((o) => o.id);
    const chosen = selected.filter((id) => ids.includes(id)).length;
    return chosen >= group.min_choice;
  });
}
