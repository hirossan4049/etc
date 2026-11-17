import { useState } from 'react';

interface FloatingButtonProps {
  retrievedCount: number;
  onClick: () => void;
}

export function FloatingButton({ retrievedCount, onClick }: FloatingButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        borderRadius: 20,
        border: 'none',
        background: '#2563EB',
        color: '#fff',
        fontFamily: 'Inter, "Noto Sans JP", sans-serif',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(37,99,235,.35)',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 100ms cubic-bezier(.2,.7,.3,1)',
        zIndex: 2147483647,
      }}
    >
      <span>ダッシュボード</span>
      {retrievedCount > 0 && (
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 9,
            background: 'rgba(255,255,255,.25)',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {retrievedCount}
        </span>
      )}
    </button>
  );
}
