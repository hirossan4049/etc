import type { MonthKey } from '../shared/types';
import { decodeShiftJis, parseCsvRows, tripDedupeKey, hashId, meisaiRowToTrip } from '../shared/parse-csv';
import type { Trip } from '../shared/types';

/**
 * 「明細CSV」リンクは実行時にDOMから探して href を読む（docs/site-notes.md）。
 * URLを決め打ちしない：セッション依存のパラメータが変わっても追従できるようにする。
 * リンクをクリックしてはいけない（新規タブ経由でOSのダウンロードが走ってしまう）。
 * 必ず fetch で直接取得し、画面上はダウンロードを発生させない。
 */
export function findCsvExportLink(): HTMLAnchorElement | undefined {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a'));
  return links.find((a) => a.textContent?.trim() === '明細CSV');
}

export async function fetchMonthCsv(_month: MonthKey): Promise<{ trips: Trip[] } | { expired: true }> {
  const link = findCsvExportLink();
  if (!link) return { expired: true };

  const response = await fetch(link.href, { credentials: 'include' });
  const buffer = await response.arrayBuffer();
  const rows = decodeCsv(buffer);
  const trips = await rowsToTrips(rows);
  return { trips };
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

export function decodeCsv(buffer: ArrayBuffer): Record<string, string>[] {
  return parseCsvRows(decodeShiftJis(buffer));
}

export function randomDelayMs(): number {
  return 1500 + Math.random() * 1500;
}
