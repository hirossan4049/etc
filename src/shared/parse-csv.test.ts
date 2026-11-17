import { describe, expect, it } from 'vitest';
import { parseCsvRows, tripDedupeKey } from './parse-csv';
import { normalizeIcName } from './normalize-ic';

describe('parseCsvRows', () => {
  it('maps header to values across rows', () => {
    const rows = parseCsvRows('利用日時,料金所,料金\n2026/11/18 09:00,東京IC,1200\n2026/11/19 10:00,八王子IC,900\n');
    expect(rows).toEqual([
      { 利用日時: '2026/11/18 09:00', 料金所: '東京IC', 料金: '1200' },
      { 利用日時: '2026/11/19 10:00', 料金所: '八王子IC', 料金: '900' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const rows = parseCsvRows('道路,備考\n東名高速,"渋滞, 遅延あり"\n');
    expect(rows[0]['備考']).toBe('渋滞, 遅延あり');
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsvRows('')).toEqual([]);
  });
});

describe('tripDedupeKey', () => {
  it('is stable for identical trips and differs when any field changes', () => {
    const base = { cardLast4: '4821', exitAt: '2026-11-18T00:00:00.000Z', exitName: '東京IC', fare: 1200 };
    expect(tripDedupeKey(base)).toBe(tripDedupeKey({ ...base }));
    expect(tripDedupeKey(base)).not.toBe(tripDedupeKey({ ...base, fare: 1000 }));
  });
});

describe('normalizeIcName', () => {
  it('strips IC/JCT suffixes and parenthetical notes', () => {
    expect(normalizeIcName('東京IC')).toBe('東京');
    expect(normalizeIcName('東京ＩＣ')).toBe('東京');
    expect(normalizeIcName('海老名JCT（下り）')).toBe('海老名');
  });
});
