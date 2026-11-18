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

export type MonthKey = string; // "YYYY-MM"（集計用。同期ジョブの単位ではない）

export type SyncPhase = 'idle' | 'running' | 'paused' | 'error' | 'done';

/**
 * 検索フォームに過去15ヶ月を明示指定→全頁選択→明細CSV、の3ステップで
 * 保有する全履歴を1回で取得できることが確認できた（docs/site-notes.md）。
 * 月ごとに繰り返す設計ではなく、この3ステップの進捗を表す。
 */
export type SyncStep = 'idle' | 'opening-search-form' | 'selecting-all-pages' | 'fetching-csv' | 'done';

export interface SyncState {
  phase: SyncPhase;
  step?: SyncStep;
  lastSyncedAt?: string;
  errorMessage?: string;
}
