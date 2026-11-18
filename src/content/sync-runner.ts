import { decodeShiftJis, parseCsvRows, tripDedupeKey, hashId, meisaiRowToTrip } from '../shared/parse-csv';
import type { SyncStep, Trip } from '../shared/types';
import { findButtonByText, findLinkByText } from './dom-helpers';

/**
 * docs/site-notes.md（2026-11-18、実アカウントで検証済み）の結論:
 * 「検索条件の指定」で from/to を過去15ヶ月に明示的にセットして検索→全頁選択→明細CSV、
 * の3ステップで保有する全履歴が1回のCSVで取得できる。月ごとに繰り返す必要はない。
 *
 * 各ステップは実際のページ遷移を伴う（検索フォームはPOSTで、URLに値が出ない）。
 * ブラウザの戻る操作等と同じ「フロー崩れ」ガード（§ site-notes.md）を誘発しないよう、
 * fetchではなく実際のDOM要素を操作して遷移させる。明細CSVの取得だけはfetchで良い
 * （クリックすると新規タブ経由のOSダウンロードが走ってしまうため）。
 *
 * ページ遷移をまたぐので、どのステップまで進んだかは呼び出し側（content/main.tsx）が
 * chrome.storage.session に保存し、ページ読み込みのたびに続きのステップを呼び出す。
 */

export function findCsvExportLink(): HTMLAnchorElement | undefined {
  return findLinkByText('明細CSV');
}

export function findSearchConditionLink(): HTMLAnchorElement | undefined {
  return findLinkByText('検索条件の指定') ?? findLinkByText('検索条件を変更する');
}

export function findSelectAllPagesLink(): HTMLAnchorElement | undefined {
  return findLinkByText('全頁選択');
}

export function findSearchSubmitButton() {
  return findButtonByText('検索');
}

/** 検索条件フォーム（from/to の年月日セレクト）が存在するページか。 */
export function isOnSearchFormPage(): boolean {
  return Boolean(document.querySelector('select[name="fromYYYY"]'));
}

function setSelectValue(name: string, value: string): boolean {
  const el = document.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  if (!el) return false;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export interface DateYmd {
  year: number;
  month: number; // 1-12
  day: number;
}

export function monthsAgo(n: number, from = new Date()): DateYmd {
  const d = new Date(from.getFullYear(), from.getMonth() - n, from.getDate());
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * 検索可能な最も古い日付。「過去15ヶ月」はちょうど15ヶ月前の同日だと対象外になり、
 * その翌日からが有効（実アカウントで確認。例: 今日が2026/11/18なら2025/08/19から有効）。
 */
export function earliestSearchableFrom(today = new Date()): DateYmd {
  const d = new Date(today.getFullYear(), today.getMonth() - 15, today.getDate() + 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 検索条件フォームの from/to を明示的にセットする。初期値はあてにしない（site-notes.md）。 */
export function setSearchRange(from: DateYmd, to: DateYmd): boolean {
  if (!isOnSearchFormPage()) return false;
  return (
    setSelectValue('fromYYYY', String(from.year)) &&
    setSelectValue('fromMM', pad2(from.month)) &&
    setSelectValue('fromDD', pad2(from.day)) &&
    setSelectValue('toYYYY', String(to.year)) &&
    setSelectValue('toMM', pad2(to.month)) &&
    setSelectValue('toDD', pad2(to.day))
  );
}

/** 検索を実行する（実際のボタンクリック＝ページ遷移が起きる）。 */
export function submitSearchForm(): boolean {
  const button = findSearchSubmitButton();
  if (!button) return false;
  button.click();
  return true;
}

/** 全頁選択を実行する（実際のリンククリック＝ページ遷移が起きる）。 */
export function clickSelectAllPages(): boolean {
  const link = findSelectAllPagesLink();
  if (!link) return false;
  link.click();
  return true;
}

export function decodeCsv(buffer: ArrayBuffer): Record<string, string>[] {
  return parseCsvRows(decodeShiftJis(buffer));
}

export async function rowsToTrips(rows: Record<string, string>[]): Promise<Trip[]> {
  const trips: Trip[] = [];
  for (const row of rows) {
    const fields = meisaiRowToTrip(row);
    if (!fields) continue;
    const id = await hashId(tripDedupeKey(fields));
    trips.push({ id, ...fields });
  }
  return trips;
}

/** 明細CSVを取得する。クリックせず fetch で直接取得する（site-notes.md）。 */
export async function fetchAllTripsCsv(): Promise<{ trips: Trip[] } | { notReady: true }> {
  const link = findCsvExportLink();
  if (!link) return { notReady: true };

  const response = await fetch(link.href, { credentials: 'include' });
  const buffer = await response.arrayBuffer();
  const rows = decodeCsv(buffer);
  const trips = await rowsToTrips(rows);
  return { trips };
}

export function randomDelayMs(): number {
  return 1500 + Math.random() * 1500;
}

export type SyncStepOutcome = { outcome: 'navigating' } | { outcome: 'blocked' } | { outcome: 'done'; trips: Trip[] };

/**
 * 現在のページで、指定されたステップに対応する「次の1手」を実行する。
 * ステップ遷移を伴うものはページ遷移が起きるので、呼び出し側（main.tsx）は
 * 'navigating' の場合は何もせず、次のページ読み込みで background に続きのステップを聞き直す。
 *
 * クリックで即座にページが遷移し得るため、`advanceStep` は実際のクリックより前に
 * 呼んで完了を待つ（クリック後だと、ページ遷移でメッセージ送信が完了しないおそれがある）。
 */
export async function runSyncStep(
  step: SyncStep,
  advanceStep: (next: SyncStep) => Promise<void>,
  fetchCsvViaBackground?: (url: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<SyncStepOutcome> {
  switch (step) {
    case 'opening-search-form': {
      if (isOnSearchFormPage()) {
        const today = monthsAgo(0);
        const from = earliestSearchableFrom();
        if (!setSearchRange(from, today)) return { outcome: 'blocked' };
        await advanceStep('selecting-all-pages');
        if (!submitSearchForm()) return { outcome: 'blocked' };
        return { outcome: 'navigating' };
      }
      const link = findSearchConditionLink();
      if (!link) return { outcome: 'blocked' };
      link.click();
      return { outcome: 'navigating' };
    }
    case 'selecting-all-pages': {
      await advanceStep('fetching-csv');
      if (!clickSelectAllPages()) return { outcome: 'blocked' };
      return { outcome: 'navigating' };
    }
    case 'fetching-csv': {
      // content script（ページ）からの fetch は、レスポンスが Content-Disposition: attachment
      // だとChromeのダウンロードマネージャに横取りされ失敗する（実機で確認、docs/site-notes.md）。
      // background（service worker）からfetchしてもらう。URLは「明細CSV」のリンク先と
      // 同じ関数コード（funccode=1013000000, nextfunc=1013500000）を決め打ちで組み立てる
      // （hrefは javascript: のため読み取れない）。
      if (!fetchCsvViaBackground) return { outcome: 'blocked' };
      const url = `${location.origin}${location.pathname}?funccode=1013000000&nextfunc=1013500000`;
      const result = await fetchCsvViaBackground(url);
      if (!result.ok) return { outcome: 'blocked' };
      return { outcome: 'done', trips: [] };
    }
    case 'idle':
    case 'done':
      return { outcome: 'done', trips: [] };
  }
}
