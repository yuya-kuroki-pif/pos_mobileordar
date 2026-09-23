import { GUEST_LOCALES, type GuestLocale } from '@/lib/guestLocale';

/**
 * お客様の言語切り替え。URL のクエリを差し替えるだけなので、
 * 同じ卓のまま言語だけ変わる。
 *
 * QR に言語を埋めてあっても、別の言語のお客様が読むことはあるので、
 * 入口の画面（連携・人数選択）にも置いている。
 */
export function LanguagePicker({
  current,
  tone = 'light',
}: {
  current: GuestLocale;
  /** 暗い背景の画面では 'dark' にする */
  tone?: 'light' | 'dark';
}) {
  const box = tone === 'dark' ? 'bg-white/10' : 'bg-charcoal-100';
  const activeItem =
    tone === 'dark'
      ? 'bg-white text-charcoal-900'
      : 'bg-white text-charcoal-900 shadow-sm';
  const idleItem = tone === 'dark' ? 'text-white/70' : 'text-charcoal-400';

  return (
    <div className={`no-select flex rounded-xl p-1 text-xs ${box}`}>
      {GUEST_LOCALES.map((item) => {
        const active = item.value === current;
        return (
          <a
            key={item.value}
            href={`?lang=${item.value}`}
            aria-current={active ? 'true' : undefined}
            className={`rounded-lg px-2 py-1 ${active ? `font-bold ${activeItem}` : idleItem}`}
          >
            {item.label}
          </a>
        );
      })}
    </div>
  );
}
