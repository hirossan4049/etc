import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeShiftJis, meisaiRowToTrip, parseCsvRows } from './parse-csv';

const fixturePath = resolve(__dirname, '../../fixtures/sample-meisai.csv');

describe('real ETC export fixture (card/vehicle numbers masked)', () => {
  const buffer = readFileSync(fixturePath);
  const text = decodeShiftJis(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const rows = parseCsvRows(text);

  it('parses all 94 rows with the real column headers', () => {
    expect(rows).toHaveLength(94);
    expect(Object.keys(rows[0])).toEqual([
      '利用年月日（自）',
      '時分（自）',
      '利用年月日（至）',
      '時分（至）',
      '利用ＩＣ（自）',
      '利用ＩＣ（至）',
      '割引前料金',
      'ＥＴＣ割引額',
      '通行料金',
      '還元額適用料金',
      '後納料金',
      '車種',
      '車両番号',
      'ＥＴＣカード番号',
      '備考',
    ]);
  });

  it('maps a plain row (no discount) correctly', () => {
    const trip = meisaiRowToTrip(rows[0]);
    expect(trip).toMatchObject({
      entryName: '堺',
      exitName: '長原',
      fare: 630,
      fareBase: 630,
      discount: undefined,
      status: 'confirmed',
      cardLast4: '0889',
    });
    expect(trip?.entryAt).toBe(new Date(2026, 3, 11, 14, 32).toISOString());
    expect(trip?.exitAt).toBe(new Date(2026, 3, 11, 14, 43).toISOString());
  });

  it('splits 備考 into status and discount label for a discounted row', () => {
    const discounted = rows.find((r) => r['備考'].includes('休日割引'));
    const trip = meisaiRowToTrip(discounted!);
    expect(trip?.status).toBe('confirmed');
    expect(trip?.discount).toBe('休日割引');
    expect(trip?.fareBase).toBe(1730);
    expect(trip?.fare).toBe(1210);
  });

  it('handles a row with a blank entry IC', () => {
    const blankEntry = rows.find((r) => r['利用ＩＣ（自）'] === '');
    expect(blankEntry).toBeDefined();
    const trip = meisaiRowToTrip(blankEntry!);
    expect(trip?.entryName).toBeUndefined();
    expect(trip?.exitName).not.toBe('');
  });
});
