import Dexie, { type EntityTable } from 'dexie';
import type { Trip } from '../shared/types';

/** Mapbox Directionsで取得した、IC間の実際の道路形状のキャッシュ(1行=1区間、キーはRouteAgg.key)。 */
export interface RouteGeometryCacheEntry {
  key: string;
  coordinates: [number, number][]; // [lon, lat]
  distanceKm: number;
  durationMin: number;
  fetchedAt: string;
}

export const db = new Dexie('etc-meisai-dashboard') as Dexie & {
  trips: EntityTable<Trip, 'id'>;
  routeGeometry: EntityTable<RouteGeometryCacheEntry, 'key'>;
};

db.version(1).stores({
  trips: 'id, exitAt, cardLast4, exitName',
});

db.version(2).stores({
  trips: 'id, exitAt, cardLast4, exitName',
  routeGeometry: 'key',
});

export async function upsertTrips(trips: Trip[]): Promise<void> {
  await db.trips.bulkPut(trips);
}

export async function getAllTrips(): Promise<Trip[]> {
  return db.trips.toArray();
}

export async function clearAllTrips(): Promise<void> {
  await db.trips.clear();
}

export async function getCachedRouteGeometry(key: string): Promise<RouteGeometryCacheEntry | undefined> {
  return db.routeGeometry.get(key);
}

export async function setCachedRouteGeometry(entry: RouteGeometryCacheEntry): Promise<void> {
  await db.routeGeometry.put(entry);
}
