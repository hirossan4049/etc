import type { MonthKey, SyncState } from '../shared/types';

const STORAGE_KEY = 'syncState';

function monthsBack(count: number): MonthKey[] {
  const months: MonthKey[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export async function loadSyncState(): Promise<SyncState> {
  const stored = await chrome.storage.session.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]) return stored[STORAGE_KEY] as SyncState;
  const initial: SyncState = {
    phase: 'idle',
    months: monthsBack(15).map((month) => ({ month, status: 'pending' as const })),
  };
  await saveSyncState(initial);
  return initial;
}

export async function saveSyncState(state: SyncState): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: state });
}

export function nextPendingMonth(state: SyncState): MonthKey | undefined {
  return state.months.find((m) => m.status === 'pending')?.month;
}
