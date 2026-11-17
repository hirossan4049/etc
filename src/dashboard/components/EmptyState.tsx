import type { ReactNode } from 'react';
import { DocEmptyIcon, RoadEmptyIcon } from './Icon';
import { LabelButton } from './Primitives';
import s from './EmptyState.module.css';

interface EmptyStateProps {
  variant: 'filtered' | 'no-data';
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
}

export function EmptyState({ variant, title, body, action, icon }: EmptyStateProps) {
  return (
    <div className={s.wrap}>
      <span className={s.icon}>{icon ?? (variant === 'filtered' ? <RoadEmptyIcon /> : <DocEmptyIcon />)}</span>
      <div className={s.title}>{title}</div>
      <div className={s.body}>{body}</div>
      {action && (
        <LabelButton variant={variant === 'no-data' ? 'filled' : 'primary'} onClick={action.onClick}>
          {action.label}
        </LabelButton>
      )}
    </div>
  );
}
