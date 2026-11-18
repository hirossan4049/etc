import { decodeShiftJis, hashId, meisaiRowToTrip, parseCsvRows, tripDedupeKey } from '../../shared/parse-csv';
import type { Trip } from '../../shared/types';

/**
 * 「明細CSV」の自動取得は、サイト側の別ウィンドウ出力の仕組みが複数タブ操作とみなされて
 * 拒否されることがあり、自動化の信頼性が低いことが実機検証で分かった（docs/site-notes.md）。
 * 実際の「明細CSV」ボタンはユーザー本人のクリックなら確実に動くため、出力されたファイルを
 * ダッシュボードに読み込む方式を正式な取り込み経路とする。
 */
export async function parseMeisaiCsvFile(file: File): Promise<Trip[]> {
  const buffer = await file.arrayBuffer();
  const text = decodeShiftJis(buffer);
  const rows = parseCsvRows(text);

  const trips: Trip[] = [];
  for (const row of rows) {
    const fields = meisaiRowToTrip(row);
    if (!fields) continue;
    const id = await hashId(tripDedupeKey(fields));
    trips.push({ id, ...fields });
  }
  return trips;
}
