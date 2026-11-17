import type { Trip } from './types';

/**
 * CSVの列名・文字コードは docs/site-notes.md の調査結果に合わせる（未確定、M1でfixtureが届いたら確定する）。
 * このデコード処理だけは §2 の見込み（Shift_JIS）に基づいて先に用意しておく。
 */
export function decodeShiftJis(buffer: ArrayBuffer): string {
  return new TextDecoder('shift_jis').decode(buffer);
}

export function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = cells[i] ?? '';
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

/** 重複判定キー。実データを見て調整する（§4）。 */
export function tripDedupeKey(trip: Pick<Trip, 'cardLast4' | 'exitAt' | 'exitName' | 'fare'>): string {
  return [trip.cardLast4, trip.exitAt, trip.exitName, trip.fare].join('|');
}

/**
 * 実際のCSV列名（docs/site-notes.md で確認済み、2026-11-18時点）:
 * 利用年月日（自）,時分（自）,利用年月日（至）,時分（至）,利用ＩＣ（自）,利用ＩＣ（至）,
 * 割引前料金,ＥＴＣ割引額,通行料金,還元額適用料金,後納料金,車種,車両番号,ＥＴＣカード番号,備考
 *
 * 道路名・距離の列は存在しない（docs/site-notes.md参照）。車両番号は保存しない。
 */
function toIsoDateTime(dateJst: string, timeJst: string): string | undefined {
  const dateMatch = dateJst.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  const timeMatch = timeJst.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return undefined;
  const [, yy, mm, dd] = dateMatch;
  const [, hh, min] = timeMatch;
  const year = 2000 + Number(yy);
  return new Date(year, Number(mm) - 1, Number(dd), Number(hh), Number(min)).toISOString();
}

function toNumberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export interface MeisaiTripFields {
  entryAt?: string;
  exitAt: string;
  entryName?: string;
  exitName: string;
  fareBase?: number;
  fare: number;
  discount?: string;
  status?: 'confirmed' | 'pending';
  cardLast4: string;
  vehicleClass?: string;
  raw: Record<string, string>;
}

/** 明細CSVの1行を Trip のフィールド（id以外）に変換する。 */
export function meisaiRowToTrip(row: Record<string, string>): MeisaiTripFields | undefined {
  const exitAt = toIsoDateTime(row['利用年月日（至）'] ?? '', row['時分（至）'] ?? '');
  if (!exitAt) return undefined;
  const entryAt = toIsoDateTime(row['利用年月日（自）'] ?? '', row['時分（自）'] ?? '');

  const fare = toNumberOrUndefined(row['後納料金'] ?? '') ?? toNumberOrUndefined(row['通行料金'] ?? '') ?? 0;
  const fareBase = toNumberOrUndefined(row['割引前料金'] ?? '') ?? fare;

  const remarks = (row['備考'] ?? '').split(';').map((s) => s.trim()).filter(Boolean);
  const status: MeisaiTripFields['status'] = remarks.includes('確定')
    ? 'confirmed'
    : remarks.includes('確認中')
      ? 'pending'
      : undefined;
  const discount = remarks.find((r) => r !== '確定' && r !== '確認中');

  const card = row['ＥＴＣカード番号'] ?? '';
  const cardLast4 = card.slice(-4);

  const entryName = (row['利用ＩＣ（自）'] ?? '').trim() || undefined;
  const exitName = (row['利用ＩＣ（至）'] ?? '').trim();

  return {
    entryAt,
    exitAt,
    entryName,
    exitName,
    fareBase,
    fare,
    discount,
    status,
    cardLast4,
    vehicleClass: row['車種'],
    raw: row,
  };
}

export async function hashId(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
