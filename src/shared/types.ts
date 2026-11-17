export interface IcRef {
  name: string;
  lat: number;
  lon: number;
}

export interface Trip {
  id: string;
  cardLast4: string;
  entryAt?: string;
  exitAt: string;
  entryName?: string;
  exitName: string;
  road?: string;
  fareBase?: number;
  fare: number;
  discount?: string;
  vehicleClass?: string;
  raw: Record<string, string>;
  ic?: { entry?: IcRef; exit?: IcRef };
  distanceKm?: number;
  speedKmh?: number;
  /** CSVの備考欄から読む。確定するまで最長3週間かかる(docs/site-notes.md参照)。 */
  status?: 'confirmed' | 'pending';
}

export type MonthKey = string; // "YYYY-MM"

export type MonthSyncStatus = 'pending' | 'done' | 'error';

export interface MonthSyncState {
  month: MonthKey;
  status: MonthSyncStatus;
  error?: string;
}

export type SyncPhase = 'idle' | 'running' | 'paused' | 'error' | 'done';

export interface SyncState {
  phase: SyncPhase;
  months: MonthSyncState[];
  lastSyncedAt?: string;
  errorMessage?: string;
}
