import type { Trip } from '../../shared/types';
import { monthKey } from './format';

export function sortByExitDesc(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) => b.exitAt.localeCompare(a.exitAt));
}

export interface DateGroup {
  key: string;
  trips: Trip[];
  sumKm: number;
  sumFare: number;
}

export function groupByDate(trips: Trip[]): DateGroup[] {
  const sorted = sortByExitDesc(trips);
  const groups = new Map<string, Trip[]>();
  for (const trip of sorted) {
    const key = trip.exitAt.slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(trip);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([key, groupTrips]) => ({
    key,
    trips: groupTrips,
    sumKm: groupTrips.reduce((acc, t) => acc + (t.distanceKm ?? 0), 0),
    sumFare: groupTrips.reduce((acc, t) => acc + t.fare, 0),
  }));
}

export interface MonthGroup {
  key: string;
  trips: Trip[];
  sumKm: number;
  sumFare: number;
}

export function groupByMonth(trips: Trip[]): MonthGroup[] {
  const sorted = sortByExitDesc(trips);
  const groups = new Map<string, Trip[]>();
  for (const trip of sorted) {
    const key = monthKey(trip.exitAt);
    const list = groups.get(key) ?? [];
    list.push(trip);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([key, groupTrips]) => ({
    key,
    trips: groupTrips,
    sumKm: groupTrips.reduce((acc, t) => acc + (t.distanceKm ?? 0), 0),
    sumFare: groupTrips.reduce((acc, t) => acc + t.fare, 0),
  }));
}

export function tripsInMonth(trips: Trip[], key: string): Trip[] {
  return trips.filter((t) => monthKey(t.exitAt) === key);
}

export function recentMonthKeys(count: number, from = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export interface MonthTotals {
  key: string;
  count: number;
  km: number;
  fare: number;
  avgSpeed: number;
}

export function monthlyTotals(trips: Trip[], keys: string[]): MonthTotals[] {
  return keys.map((key) => {
    const monthTrips = tripsInMonth(trips, key);
    const km = monthTrips.reduce((acc, t) => acc + (t.distanceKm ?? 0), 0);
    const fare = monthTrips.reduce((acc, t) => acc + t.fare, 0);
    const speeds = monthTrips.filter((t) => t.speedKmh).map((t) => t.speedKmh as number);
    const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    return { key, count: monthTrips.length, km, fare, avgSpeed };
  });
}

export function pctDelta(current: number, previous: number): number | undefined {
  if (!previous) return undefined;
  return ((current - previous) / previous) * 100;
}

export interface RankingRow {
  name: string;
  count: number;
  km: number;
  fare: number;
}

export function rankByRoad(trips: Trip[]): RankingRow[] {
  const map = new Map<string, RankingRow>();
  for (const t of trips) {
    const name = t.road ?? '不明';
    const row = map.get(name) ?? { name, count: 0, km: 0, fare: 0 };
    row.count += 1;
    row.km += t.distanceKm ?? 0;
    row.fare += t.fare;
    map.set(name, row);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export interface IcRankRow {
  name: string;
  count: number;
}

export function rankByIc(trips: Trip[]): IcRankRow[] {
  const map = new Map<string, number>();
  for (const t of trips) {
    for (const name of [t.entryName, t.exitName]) {
      if (!name) continue;
      map.set(name, (map.get(name) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function hourHistogram(trips: Trip[]): number[] {
  const hours = new Array(24).fill(0);
  for (const t of trips) {
    const h = new Date(t.exitAt).getHours();
    hours[h] += 1;
  }
  return hours;
}

export const TIME_BLOCKS = ['0–4', '4–8', '8–12', '12–16', '16–20', '20–24'] as const;
export const WEEKDAYS_JA = ['月', '火', '水', '木', '金', '土', '日'] as const;

export function weekdayTimeHeatmap(trips: Trip[]): number[][] {
  const grid = WEEKDAYS_JA.map(() => new Array(TIME_BLOCKS.length).fill(0));
  for (const t of trips) {
    const d = new Date(t.exitAt);
    const jsDay = d.getDay(); // 0=Sun
    const row = jsDay === 0 ? 6 : jsDay - 1; // Mon=0..Sun=6
    const block = Math.min(5, Math.floor(d.getHours() / 4));
    grid[row][block] += 1;
  }
  return grid;
}

export interface RouteAgg {
  key: string;
  entryName: string;
  exitName: string;
  road?: string;
  freq: number;
  trips: Trip[];
}

export function aggregateRoutes(trips: Trip[]): RouteAgg[] {
  const map = new Map<string, RouteAgg>();
  for (const t of trips) {
    if (!t.entryName) continue;
    const key = [t.entryName, t.exitName].sort().join('__');
    const existing = map.get(key);
    if (existing) {
      existing.freq += 1;
      existing.trips.push(t);
    } else {
      map.set(key, { key, entryName: t.entryName, exitName: t.exitName, road: t.road, freq: 1, trips: [t] });
    }
  }
  return Array.from(map.values());
}

export interface RecordsOfMonth {
  longest?: Trip;
  fastestAvg?: Trip;
  discountCount: number;
  discountSavings: number;
  topCorridor?: { label: string; count: number; avgMinutes: number };
}

export function recordsOfMonth(trips: Trip[]): RecordsOfMonth {
  const longest = [...trips].sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0))[0];
  const fastestAvg = [...trips].sort((a, b) => (b.speedKmh ?? 0) - (a.speedKmh ?? 0))[0];
  const discounted = trips.filter((t) => t.discount);
  const discountSavings = discounted.reduce((acc, t) => acc + ((t.fareBase ?? t.fare) - t.fare), 0);

  const corridors = aggregateRoutes(trips).sort((a, b) => b.freq - a.freq);
  const top = corridors[0];
  let topCorridor: RecordsOfMonth['topCorridor'];
  if (top) {
    const durations = top.trips
      .filter((t) => t.entryAt)
      .map((t) => (new Date(t.exitAt).getTime() - new Date(t.entryAt as string).getTime()) / 60000);
    const avgMinutes = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    topCorridor = { label: `${top.entryName} ⇄ ${top.exitName}`, count: top.freq, avgMinutes };
  }

  return { longest, fastestAvg, discountCount: discounted.length, discountSavings, topCorridor };
}
