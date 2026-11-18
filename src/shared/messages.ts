import type { SyncState, SyncStep, Trip } from './types';

export const PORT_NAME = 'etc-dashboard-sync';

/** chrome.runtime.sendMessage の一回限りのメッセージ（content ⇄ background）。 */
export type OneOffMessage =
  | { type: 'OPEN_DASHBOARD' }
  | { type: 'SYNC_REQUEST_STEP' }
  | { type: 'SYNC_ADVANCE'; step: SyncStep }
  | { type: 'SYNC_STEP_BLOCKED' }
  | { type: 'SYNC_CSV_FETCHED'; trips: Trip[] }
  | { type: 'SYNC_FETCH_CSV_URL'; url: string }
  | { type: 'SYNC_ERROR'; message: string }
  | { type: 'SESSION_EXPIRED' };

export type SyncStepResponse = { phase: 'running'; step: SyncStep } | { phase: 'idle' };

export type BackgroundToDashboard =
  | { type: 'SYNC_STATE'; state: SyncState }
  | { type: 'TRIPS_DELTA'; trips: Trip[] };

export type DashboardToBackground =
  | { type: 'REQUEST_SYNC_STATE' }
  | { type: 'RETRY_SYNC' }
  | { type: 'FOCUS_ETC_TAB' };
