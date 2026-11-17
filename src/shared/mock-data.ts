import type { Trip } from './types';

const ROADS = ['東名高速', '首都高速', '中央自動車道', '関越自動車道', '東北自動車道'];
const ICS = ['東京IC', '厚木IC', '横浜町田IC', '八王子IC', '川口IC', '大宮IC', '所沢IC', '新宿線 代々木IC'];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** 開発中のダッシュボード表示確認用。実データは背景側の同期で置き換わる。 */
export function generateMockTrips(count = 180): Trip[] {
  const trips: Trip[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor((i / count) * 450);
    const exit = new Date(now - daysAgo * 86400000 - (i % 17) * 3600000);
    const entryName = pick(ICS, i);
    let exitName = pick(ICS, i + 3);
    if (exitName === entryName) exitName = pick(ICS, i + 5);
    const fareBase = 800 + (i % 12) * 150;
    const hasDiscount = i % 4 === 0;
    const avgSpeedKmh = 60 + (i % 5) * 8;
    const durationMin = 15 + (i % 12) * 7;
    const distanceKm = Math.round(((durationMin / 60) * avgSpeedKmh) * 10) / 10;
    trips.push({
      id: `mock-${i}`,
      cardLast4: '4821',
      entryAt: new Date(exit.getTime() - durationMin * 60000).toISOString(),
      exitAt: exit.toISOString(),
      entryName,
      exitName,
      road: pick(ROADS, i),
      fareBase,
      fare: hasDiscount ? Math.round(fareBase * 0.8) : fareBase,
      discount: hasDiscount ? '深夜割引' : undefined,
      vehicleClass: '普通車',
      raw: {},
      distanceKm,
      speedKmh: avgSpeedKmh,
    });
  }
  return trips;
}
