import { useEffect } from 'react';
import { CheckIcon } from './Icon';
import s from './Toast.module.css';

interface ErrorToastProps {
  message: string;
  onRetry: () => void;
}

export function ErrorToast({ message, onRetry }: ErrorToastProps) {
  return (
    <div className={`${s.wrap} ${s.error}`} role="alert">
      <span className={s.dot} style={{ background: 'var(--error)' }} />
      <span className={s.msg}>{message}</span>
      <button type="button" className={s.action} onClick={onRetry}>
        再試行
      </button>
    </div>
  );
}

interface SuccessToastProps {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export function SuccessToast({ message, onUndo, onDismiss, durationMs = 2400 }: SuccessToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <div className={`${s.wrap} ${s.success}`} role="status">
      <CheckIcon />
      <span className={s.msg}>{message}</span>
      {onUndo && (
        <button type="button" className={`${s.action} ${s.successAction}`} onClick={onUndo}>
          取り消す
        </button>
      )}
    </div>
  );
}
