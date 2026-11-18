import type { LatLon } from '../../shared/ic-coordinates';
import { getCachedRouteGeometry, setCachedRouteGeometry, type RouteGeometryCacheEntry } from '../../background/store';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * IC座標テーブル(`ic-coordinates.ts`)を直すたびに上げる。変えないと、古い(誤った)
 * 座標から計算してキャッシュ済みの道路形状がIndexedDBに残ったまま使われ続けてしまう。
 */
const GEOMETRY_CACHE_VERSION = 'v2';

/**
 * Mapbox Directions(driving)で区間の実際の道路形状を取得する。
 * 「車線にトレース」は厳密な車線単位ではなく、実際の道路線形(センターライン)への
 * スナップを指す(Mapboxはレーン単位のジオメトリは提供していない)。
 * 区間(key)ごとに1回だけ呼び、結果はIndexedDBに永続キャッシュする。
 * 取得できない場合(トークン未設定・経路なし・APIエラー)は undefined を返し、
 * 呼び出し側は entry-exit の直線にフォールバックする。
 */
export async function fetchRouteGeometry(key: string, entry: LatLon, exit: LatLon): Promise<RouteGeometryCacheEntry | undefined> {
  const cacheKey = `${GEOMETRY_CACHE_VERSION}:${key}`;
  const cached = await getCachedRouteGeometry(cacheKey);
  if (cached) return cached;
  if (!MAPBOX_TOKEN) return undefined;

  const coordsParam = `${entry.lon},${entry.lat};${exit.lon},${exit.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsParam}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = await res.json();
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates as [number, number][] | undefined;
    if (!coordinates || coordinates.length < 2) return undefined;

    const entryRecord: RouteGeometryCacheEntry = {
      key: cacheKey,
      coordinates,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
      fetchedAt: new Date().toISOString(),
    };
    await setCachedRouteGeometry(entryRecord);
    return entryRecord;
  } catch {
    return undefined;
  }
}
