import type { MonthKey, SyncState, Trip } from './types';

export const PORT_NAME = 'etc-dashboard-sync';

export type ContentToBackground =
  | { type: 'START_SYNC'; tabId: number }
  | { type: 'MONTH_RESULT'; month: MonthKey; trips: Trip[] }
  | { type: 'MONTH_ERROR'; month: MonthKey; error: string }
  | { type: 'SESSION_EXPIRED' };

export type BackgroundToContent =
  | { type: 'FETCH_MONTH'; month: MonthKey }
  | { type: 'STOP' };

export type BackgroundToDashboard =
  | { type: 'SYNC_STATE'; state: SyncState }
  | { type: 'TRIPS_DELTA'; trips: Trip[] };

export type DashboardToBackground =
  | { type: 'REQUEST_SYNC_STATE' }
  | { type: 'RETRY_SYNC' }
  | { type: 'FOCUS_ETC_TAB' };
