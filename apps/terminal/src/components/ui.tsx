import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// 画面をまたいで使う小さな部品。
// UI ライブラリを入れずに済ませ、依存を増やさない方針。
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ember-600 text-white hover:bg-ember-700 active:bg-ember-800 disabled:bg-ember-300',
  secondary:
    'bg-white text-charcoal-800 border border-charcoal-200 hover:bg-charcoal-50 active:bg-charcoal-100',
  ghost: 'bg-transparent text-charcoal-600 hover:bg-charcoal-100 active:bg-charcoal-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
  dark: 'bg-charcoal-800 text-white hover:bg-charcoal-700 active:bg-charcoal-900',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  // 業務画面はタブレットの指操作が前提なので、既定でも十分な高さを確保する
  md: 'px-4 py-2.5 text-[15px] rounded-xl',
  lg: 'px-6 py-4 text-lg rounded-2xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={`no-select inline-flex items-center justify-center gap-2 font-semibold
        transition-colors disabled:cursor-not-allowed disabled:opacity-60
        ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    />
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-charcoal-100 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'warn' | 'good' | 'alert' | 'info';
}) {
  const tones = {
    neutral: 'bg-charcoal-100 text-charcoal-600',
    warn: 'bg-amber-100 text-amber-800',
    good: 'bg-emerald-100 text-emerald-800',
    alert: 'bg-red-100 text-red-700',
    info: 'bg-sky-100 text-sky-800',
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-charcoal-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-charcoal-400">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-charcoal-200 bg-white px-3 py-2.5 text-[15px]
        outline-none placeholder:text-charcoal-300
        focus:border-ember-400 focus:ring-2 focus:ring-ember-100 ${className}`}
    />
  );
}

/** 空状態の案内。一覧が 0 件のときに何をすればよいか伝える */
export function Empty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-charcoal-200 bg-white/50 px-6 py-12 text-center">
      <p className="font-semibold text-charcoal-600">{title}</p>
      {description && <p className="mt-1 text-sm text-charcoal-400">{description}</p>}
    </div>
  );
}

/** 画面上部の見出し */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-charcoal-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-charcoal-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** 集計値を 1 つ見せるタイル */
export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-charcoal-500">{label}</p>
      <p className="tabular mt-1 text-3xl font-bold tracking-tight text-charcoal-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-charcoal-400">{sub}</p>}
    </Card>
  );
}
