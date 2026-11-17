import { NavLink } from 'react-router-dom';
import type { SyncState } from '../../shared/types';
import { CardIcon, ChevronDownIcon, ThemeIcon } from './Icon';
import { IconButton } from './Primitives';
import s from './Header.module.css';

interface HeaderProps {
  syncState: SyncState;
  cardLast4: string;
  onToggleTheme: () => void;
}

function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')} 同期`;
}

export function Header({ syncState, cardLast4, onToggleTheme }: HeaderProps) {
  const isError = syncState.phase === 'error';

  return (
    <header className={s.header}>
      <div className={`${s.brand} ${s.hideSmall}`}>
        <svg className={s.logo} viewBox="0 0 20 20" fill="none">
          <rect width="20" height="20" rx="5" fill="var(--text)" />
          <path
            d="M4 11c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4-1.5"
            stroke="var(--surface)"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <span>ETC走行履歴</span>
      </div>

      <nav className={s.nav}>
        <NavLink to="/explore" className={({ isActive }) => `${s.tab} ${isActive ? s.on : ''}`}>
          Explore
        </NavLink>
        <NavLink to="/insights" className={({ isActive }) => `${s.tab} ${isActive ? s.on : ''}`}>
          Insights
        </NavLink>
        <NavLink to="/records" className={({ isActive }) => `${s.tab} ${isActive ? s.on : ''}`}>
          Records
        </NavLink>
      </nav>

      <div className={s.spacer} />

      <div className={`${s.sync} ${s.hideSmall} num`}>
        <span className={`${s.dot} ${isError ? s.dotError : ''}`} />
        <span>{syncState.lastSyncedAt ? formatSyncedAt(syncState.lastSyncedAt) : '同期待ち'}</span>
      </div>

      <button type="button" className={`${s.cardChip} ${s.hideSmall}`}>
        <CardIcon />
        <span className="num">•••• {cardLast4}</span>
        <ChevronDownIcon />
      </button>

      <IconButton label="テーマ切替" onClick={onToggleTheme}>
        <ThemeIcon />
      </IconButton>
    </header>
  );
}
