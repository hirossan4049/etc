import type { ButtonHTMLAttributes, ReactNode } from 'react';
import s from './primitives.module.css';

export function IconButton({
  label,
  children,
  ...rest
}: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={s.ibtn} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function LabelButton({
  children,
  variant,
  className,
  ...rest
}: { children: ReactNode; variant?: 'primary' | 'filled' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = variant === 'primary' ? `${s.lbtn} ${s.lbtnPrimary}` : variant === 'filled' ? s.lbtnFilled : s.lbtn;
  const cls = className ? `${base} ${className}` : base;
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={s.seg} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          className={`${s.segBtn} ${opt.value === value ? s.on : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  dashed,
  children,
  ...rest
}: { active?: boolean; dashed?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [s.chip, active ? s.on : '', dashed ? s.chipDashed : ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className={s.tag}>{children}</span>;
}

export function Divider({ vertical }: { vertical?: boolean }) {
  return vertical ? <span className={s.divider} /> : null;
}

export function FloatPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={[s.float, className].filter(Boolean).join(' ')}>{children}</div>;
}
