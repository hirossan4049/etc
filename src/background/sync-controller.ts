import type { SyncState } from '../shared/types';

const STORAGE_KEY = 'syncState';

const initialState: SyncState = { phase: 'idle' };

export async function loadSyncState(): Promise<SyncState> {
  const stored = await chrome.storage.session.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]) return stored[STORAGE_KEY] as SyncState;
  await saveSyncState(initialState);
  return initialState;
}

export async function saveSyncState(state: SyncState): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: state });
}
