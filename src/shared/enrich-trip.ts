import type { Trip } from './types';
import { getIcCoordinate } from './ic-coordinates';

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * IC座標テーブル(`ic-coordinates.ts`)から ic/distanceKm/speedKmh を補う。
 * 直線距離なので実際の道路距離より短くなる(§5 Phase 2の道路網ベース距離推定は未実装)。
 * 既に値が入っているフィールド(モックデータ等)は上書きしない。
 */
export function enrichTrip(trip: Trip): Trip {
  const entry = trip.ic?.entry ?? (trip.entryName ? toIcRef(trip.entryName) : undefined);
  const exit = trip.ic?.exit ?? toIcRef(trip.exitName);

  let distanceKm = trip.distanceKm;
  let speedKmh = trip.speedKmh;
  if (distanceKm === undefined && entry && exit) {
    distanceKm = Math.round(haversineKm(entry, exit) * 10) / 10;
  }
  if (speedKmh === undefined && distanceKm !== undefined && trip.entryAt) {
    const hours = (new Date(trip.exitAt).getTime() - new Date(trip.entryAt).getTime()) / 3_600_000;
    if (hours > 0) speedKmh = Math.round((distanceKm / hours) * 10) / 10;
  }

  if (!entry && !exit && distanceKm === trip.distanceKm && speedKmh === trip.speedKmh) return trip;
  return { ...trip, ic: { entry, exit }, distanceKm, speedKmh };
}

function toIcRef(name: string) {
  const coord = getIcCoordinate(name);
  if (!coord) return undefined;
  return { name, lat: coord.lat, lon: coord.lon };
}
