import Dexie, { type EntityTable } from 'dexie';
import type { Trip } from '../shared/types';

export const db = new Dexie('etc-meisai-dashboard') as Dexie & {
  trips: EntityTable<Trip, 'id'>;
};

db.version(1).stores({
  trips: 'id, exitAt, cardLast4, exitName',
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
