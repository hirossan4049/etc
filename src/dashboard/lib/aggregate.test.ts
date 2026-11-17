import { describe, expect, it } from 'vitest';
import type { Trip } from '../../shared/types';
import { aggregateRoutes, rankByRoad } from './aggregate';

function trip(overrides: Partial<Trip>): Trip {
  return {
    id: 'id',
    cardLast4: '4821',
    exitAt: '2026-11-18T00:00:00.000Z',
    exitName: '八王子IC',
    entryName: '東京IC',
    road: '東名高速',
    fare: 1000,
    raw: {},
    ...overrides,
  };
}

describe('aggregateRoutes', () => {
  it('groups trips sharing the same IC pair regardless of direction', () => {
    const routes = aggregateRoutes([
      trip({ id: 'a', entryName: '東京IC', exitName: '八王子IC' }),
      trip({ id: 'b', entryName: '八王子IC', exitName: '東京IC' }),
      trip({ id: 'c', entryName: '東京IC', exitName: '厚木IC' }),
    ]);
    expect(routes).toHaveLength(2);
    const tokyoHachioji = routes.find((r) => r.trips.length === 2);
    expect(tokyoHachioji?.freq).toBe(2);
  });
});

describe('rankByRoad', () => {
  it('sorts roads by trip count descending', () => {
    const ranking = rankByRoad([
      trip({ id: 'a', road: '首都高速' }),
      trip({ id: 'b', road: '東名高速' }),
      trip({ id: 'c', road: '東名高速' }),
    ]);
    expect(ranking[0].name).toBe('東名高速');
    expect(ranking[0].count).toBe(2);
  });
});
