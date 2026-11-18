import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  monthsAgo,
  earliestSearchableFrom,
  runSyncStep,
  setSearchRange,
  isOnSearchFormPage,
  fetchAllTripsCsv,
} from './sync-runner';

const fixturePath = resolve(__dirname, '../../fixtures/sample-meisai.csv');

function setBody(html: string) {
  document.body.innerHTML = html;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('monthsAgo', () => {
  it('computes year/month/day N months before a reference date', () => {
    expect(monthsAgo(15, new Date(2026, 10, 18))).toEqual({ year: 2025, month: 8, day: 18 });
    expect(monthsAgo(0, new Date(2026, 10, 18))).toEqual({ year: 2026, month: 11, day: 18 });
  });
});

describe('earliestSearchableFrom', () => {
  it('is one day after exactly 15 months ago (exact 15-months-ago is rejected by the real site)', () => {
    expect(earliestSearchableFrom(new Date(2026, 10, 18))).toEqual({ year: 2025, month: 8, day: 19 });
  });

  it('handles month-length rollover correctly', () => {
    // 2026-05-31 minus 15 months lands on 2025-02-31, which doesn't exist (Feb has 28 days in 2025);
    // Date normalizes it to 2025-03-03, then +1 day gives 2025-03-04.
    expect(earliestSearchableFrom(new Date(2026, 4, 31))).toEqual({ year: 2025, month: 3, day: 4 });
  });
});

function searchFormHtml(): string {
  const yearOptions = (years: number[]) => years.map((y) => `<option value="${y}">${y}</option>`).join('');
  const padded = (count: number) =>
    Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0'))
      .map((v) => `<option value="${v}">${v}</option>`)
      .join('');
  return `
    <select name="fromYYYY">${yearOptions([2025, 2026])}</select>
    <select name="fromMM">${padded(12)}</select>
    <select name="fromDD">${padded(31)}</select>
    <select name="toYYYY">${yearOptions([2025, 2026])}</select>
    <select name="toMM">${padded(12)}</select>
    <select name="toDD">${padded(31)}</select>
    <button type="submit">検索</button>
  `;
}

describe('isOnSearchFormPage / setSearchRange', () => {
  it('detects the search form and sets the date range', () => {
    setBody(searchFormHtml());
    expect(isOnSearchFormPage()).toBe(true);
    const ok = setSearchRange({ year: 2025, month: 8, day: 19 }, { year: 2026, month: 11, day: 18 });
    expect(ok).toBe(true);
    expect((document.querySelector('select[name="fromYYYY"]') as HTMLSelectElement).value).toBe('2025');
    expect((document.querySelector('select[name="fromMM"]') as HTMLSelectElement).value).toBe('08');
    expect((document.querySelector('select[name="toDD"]') as HTMLSelectElement).value).toBe('18');
  });

  it('returns false when not on the search form page', () => {
    setBody('<p>no form here</p>');
    expect(isOnSearchFormPage()).toBe(false);
  });
});

describe('runSyncStep', () => {
  it('opening-search-form: navigates to the search condition page when not already there', async () => {
    setBody('<a href="/search">検索条件の指定</a>');
    const advanceStep = vi.fn().mockResolvedValue(undefined);
    const result = await runSyncStep('opening-search-form', advanceStep);
    expect(result).toEqual({ outcome: 'navigating' });
    expect(advanceStep).not.toHaveBeenCalled();
  });

  it('opening-search-form: fills and submits the form when already on it, advancing the step first', async () => {
    setBody(searchFormHtml());
    const calls: string[] = [];
    const advanceStep = vi.fn().mockImplementation(async (step: string) => {
      calls.push(step);
    });
    const button = document.querySelector('button') as HTMLButtonElement;
    let clicked = false;
    button.addEventListener('click', () => {
      clicked = true;
    });

    const result = await runSyncStep('opening-search-form', advanceStep);
    expect(result).toEqual({ outcome: 'navigating' });
    expect(calls).toEqual(['selecting-all-pages']);
    expect(clicked).toBe(true);
    // advanceStep must resolve before the click fires
    expect(calls.indexOf('selecting-all-pages')).toBeGreaterThanOrEqual(0);
  });

  it('opening-search-form: reports blocked when neither the form nor the nav link exist', async () => {
    setBody('<p>unexpected page</p>');
    const result = await runSyncStep('opening-search-form', vi.fn());
    expect(result).toEqual({ outcome: 'blocked' });
  });

  it('selecting-all-pages: clicks the 全頁選択 link after advancing to fetching-csv', async () => {
    setBody('<a href="/all">全頁選択</a>');
    const advanceStep = vi.fn().mockResolvedValue(undefined);
    const result = await runSyncStep('selecting-all-pages', advanceStep);
    expect(result).toEqual({ outcome: 'navigating' });
    expect(advanceStep).toHaveBeenCalledWith('fetching-csv');
  });

  describe('fetching-csv', () => {
    it('asks background to fetch the deterministic CSV output URL (content-script fetch fails on attachment downloads; see site-notes.md)', async () => {
      const fetchCsvViaBackground = vi.fn().mockResolvedValue({ ok: true });
      const result = await runSyncStep('fetching-csv', vi.fn(), fetchCsvViaBackground);
      expect(result).toEqual({ outcome: 'done', trips: [] });
      expect(fetchCsvViaBackground).toHaveBeenCalledWith(
        expect.stringContaining('funccode=1013000000&nextfunc=1013500000'),
      );
    });

    it('reports blocked when background reports failure', async () => {
      const fetchCsvViaBackground = vi.fn().mockResolvedValue({ ok: false, error: 'boom' });
      const result = await runSyncStep('fetching-csv', vi.fn(), fetchCsvViaBackground);
      expect(result).toEqual({ outcome: 'blocked' });
    });

    it('reports blocked when no fetchCsvViaBackground callback is given', async () => {
      const result = await runSyncStep('fetching-csv', vi.fn());
      expect(result).toEqual({ outcome: 'blocked' });
    });
  });
});

describe('fetchAllTripsCsv (kept for potential future use; see site-notes.md)', () => {
  it('fetches and parses the real (masked) CSV export from the 明細CSV link', async () => {
    setBody('<a href="https://www2.etc-meisai.jp/csv">明細CSV</a>');
    const raw = readFileSync(fixturePath);
    const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    const fetchMock = vi.fn().mockResolvedValue({ arrayBuffer: async () => buffer });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAllTripsCsv();
    expect('trips' in result).toBe(true);
    if ('trips' in result) {
      expect(result.trips).toHaveLength(94);
      expect(result.trips[0]).toMatchObject({ entryName: '堺', exitName: '長原', fare: 630 });
    }
    expect(fetchMock).toHaveBeenCalledWith('https://www2.etc-meisai.jp/csv', { credentials: 'include' });
  });

  it('reports notReady when the CSV link is missing', async () => {
    setBody('<p>no csv link</p>');
    const result = await fetchAllTripsCsv();
    expect(result).toEqual({ notReady: true });
  });
});
