'use client';

import { useMemo, useState } from 'react';

import { formatYen } from '@/lib/format';
import type { CartLine, MenuItemWithOptions } from '@/lib/types';
import { buildCartLine, isSelectionValid, toggleOption } from '@/lib/useCart';

/**
 * 商品を選んだときに出すオプション選択ダイアログ。
 * モバイルオーダーと POS の注文入力で共用する。
 *
 * オプションが 1 つもない商品では呼び出し側が直接カートへ入れるため、
 * ここには来ない想定。
 */
export function OptionDialog({
  item,
  onAdd,
  onClose,
  allowNote = true,
}: {
  item: MenuItemWithOptions;
  onAdd: (line: CartLine) => void;
  onClose: () => void;
  /** POS では店員が備考を入れたい場面が多い。客向けでも要望欄として使う */
  allowNote?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    // 必須グループは先頭の選択肢を初期選択にして、迷わず進めるようにする
    item.option_groups.flatMap((group) =>
      group.min_select > 0 && group.options[0] ? [group.options[0].id] : []
    )
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const line = useMemo(
    () => buildCartLine(item, selected, quantity, note.trim()),
    [item, selected, quantity, note]
  );
  const valid = isSelectionValid(item, selected);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-charcoal-900/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-charcoal-100 px-5 py-4">
          <h2 className="text-lg font-bold">{item.name}</h2>
          {item.description && (
            <p className="mt-0.5 text-sm text-charcoal-500">{item.description}</p>
          )}
          <p className="tabular mt-1 font-semibold text-ember-600">{formatYen(item.price)}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {item.option_groups.map((group) => {
            const groupOptionIds = group.options.map((o) => o.id);
            const chosen = selected.filter((id) => groupOptionIds.includes(id)).length;

            return (
              <fieldset key={group.id} className="mb-5">
                <legend className="mb-2 flex w-full items-center gap-2">
                  <span className="font-bold text-charcoal-800">{group.name}</span>
                  {group.min_select > 0 ? (
                    <span className="rounded bg-ember-100 px-1.5 py-0.5 text-[11px] font-bold text-ember-700">
                      必須
                    </span>
                  ) : (
                    <span className="rounded bg-charcoal-100 px-1.5 py-0.5 text-[11px] font-semibold text-charcoal-500">
                      任意
                    </span>
                  )}
                  {group.max_select > 1 && (
                    <span className="text-xs text-charcoal-400">
                      {chosen}/{group.max_select} 選択
                    </span>
                  )}
                </legend>

                <div className="space-y-2">
                  {group.options.map((option) => {
                    const isOn = selected.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setSelected((current) =>
                            toggleOption(current, option, group, groupOptionIds)
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3
                          text-left transition-colors ${
                            isOn
                              ? 'border-ember-500 bg-ember-50'
                              : 'border-charcoal-100 bg-white active:bg-charcoal-50'
                          }`}
                      >
                        <span className="font-medium">{option.name}</span>
                        <span className="tabular text-sm text-charcoal-500">
                          {option.price_delta === 0
                            ? ''
                            : option.price_delta > 0
                              ? `+${formatYen(option.price_delta)}`
                              : `-${formatYen(-option.price_delta)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          {allowNote && (
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-charcoal-800">備考</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={100}
                placeholder="例：わさび抜き"
                className="w-full rounded-xl border border-charcoal-200 px-3 py-2.5 outline-none
                  focus:border-ember-400 focus:ring-2 focus:ring-ember-100"
              />
            </label>
          )}
        </div>

        <div className="border-t border-charcoal-100 px-5 py-4">
          <div className="no-select mb-3 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-11 w-11 rounded-full bg-charcoal-100 text-2xl font-bold text-charcoal-700 active:bg-charcoal-200"
              aria-label="数量を減らす"
            >
              −
            </button>
            <span className="tabular w-10 text-center text-2xl font-bold">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="h-11 w-11 rounded-full bg-charcoal-100 text-2xl font-bold text-charcoal-700 active:bg-charcoal-200"
              aria-label="数量を増やす"
            >
              ＋
            </button>
          </div>

          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              onAdd(line);
              onClose();
            }}
            className="tabular w-full rounded-2xl bg-ember-600 py-4 text-lg font-bold text-white
              transition-colors active:bg-ember-800 disabled:bg-charcoal-200 disabled:text-charcoal-400"
          >
            {valid
              ? `カートに追加  ${formatYen((item.price + line.options_price) * quantity)}`
              : '必須の選択があります'}
          </button>
        </div>
      </div>
    </div>
  );
}
