import { beforeEach, describe, expect, it } from 'vitest';

import {
  FlightListItem,
  FlightSyncStatus,
} from '../models/flight-list-item.model';
import { FlightListSortService } from './flight-list-sort.service';

describe('FlightListSortService', () => {
  let service: FlightListSortService;

  beforeEach(() => {
    service = new FlightListSortService();
  });

  it('should return a new array without mutating the input', () => {
    const items = [
      createItem({ id: 'b', pilot: 'Beta' }),
      createItem({ id: 'a', pilot: 'Alpha' }),
    ];

    const result = service.sort(items, {
      key: 'pilot',
      direction: 'asc',
    });

    expect(result).not.toBe(items);
    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
    expect(items.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('should sort flight dates ascending', () => {
    const items = [
      createItem({ id: 'c', flightDate: '2026-07-03' }),
      createItem({ id: 'a', flightDate: '2026-05-01' }),
      createItem({ id: 'b', flightDate: '2026-06-15' }),
    ];

    const result = service.sort(items, {
      key: 'flightDate',
      direction: 'asc',
    });

    expectIds(result, ['a', 'b', 'c']);
  });

  it('should sort flight dates descending', () => {
    const items = [
      createItem({ id: 'a', flightDate: '2026-05-01' }),
      createItem({ id: 'b', flightDate: '2026-06-15' }),
      createItem({ id: 'c', flightDate: '2026-07-03' }),
    ];

    const result = service.sort(items, {
      key: 'flightDate',
      direction: 'desc',
    });

    expectIds(result, ['c', 'b', 'a']);
  });

  it('should use imported date when flight date is missing', () => {
    const items = [
      createItem({
        id: 'b',
        flightDate: null,
        importedAtUtc: '2026-06-01T12:00:00Z',
      }),
      createItem({
        id: 'a',
        flightDate: null,
        importedAtUtc: '2026-05-01T12:00:00Z',
      }),
    ];

    const result = service.sort(items, {
      key: 'flightDate',
      direction: 'asc',
    });

    expectIds(result, ['a', 'b']);
  });

  it('should prefer local flight date over backend flight date', () => {
    const items = [
      createItem({
        id: 'mixed',
        flightDate: '2026-05-01',
        backendFlightDate: '2026-01-01',
      }),
      createItem({
        id: 'other',
        flightDate: '2026-04-01',
      }),
    ];

    const result = service.sort(items, {
      key: 'flightDate',
      direction: 'asc',
    });

    expectIds(result, ['other', 'mixed']);
  });

  it('should sort pilots alphabetically', () => {
    const items = [
      createItem({ id: 'c', pilot: 'Charlie' }),
      createItem({ id: 'a', pilot: 'Alpha' }),
      createItem({ id: 'b', pilot: 'Beta' }),
    ];

    const result = service.sort(items, {
      key: 'pilot',
      direction: 'asc',
    });

    expectIds(result, ['a', 'b', 'c']);
  });

  it('should prefer the local pilot over the backend pilot', () => {
    const items = [
      createItem({
        id: 'mixed',
        pilot: 'Zulu',
        backendPilot: 'Alpha',
      }),
      createItem({
        id: 'other',
        pilot: 'Beta',
      }),
    ];

    const result = service.sort(items, {
      key: 'pilot',
      direction: 'asc',
    });

    expectIds(result, ['other', 'mixed']);
  });

  it('should use backend pilot when no local flight exists', () => {
    const items = [
      createItem({
        id: 'b',
        local: false,
        backendPilot: 'Beta',
      }),
      createItem({
        id: 'a',
        local: false,
        backendPilot: 'Alpha',
      }),
    ];

    const result = service.sort(items, {
      key: 'pilot',
      direction: 'asc',
    });

    expectIds(result, ['a', 'b']);
  });

  it('should sort gliders alphabetically', () => {
    const items = [
      createItem({ id: 'c', glider: 'Nova' }),
      createItem({ id: 'a', glider: 'Advance' }),
      createItem({ id: 'b', glider: 'Gin' }),
    ];

    const result = service.sort(items, {
      key: 'glider',
      direction: 'asc',
    });

    expectIds(result, ['a', 'b', 'c']);
  });

  it('should place missing strings last when sorting ascending', () => {
    const items = [
      createItem({ id: 'missing', pilot: null }),
      createItem({ id: 'blank', pilot: '   ' }),
      createItem({ id: 'beta', pilot: 'Beta' }),
      createItem({ id: 'alpha', pilot: 'Alpha' }),
    ];

    const result = service.sort(items, {
      key: 'pilot',
      direction: 'asc',
    });

    expectIds(result, ['alpha', 'beta', 'missing', 'blank']);
  });

  it('should place missing strings first when sorting descending', () => {
    const items = [
      createItem({ id: 'alpha', pilot: 'Alpha' }),
      createItem({ id: 'missing', pilot: null }),
      createItem({ id: 'beta', pilot: 'Beta' }),
    ];

    const result = service.sort(items, {
      key: 'pilot',
      direction: 'desc',
    });

    expect(result[0].id).toBe('missing');
    expect(result.slice(1).map((item) => item.id)).toEqual([
      'beta',
      'alpha',
    ]);
  });

  it.each([
    ['durationSec', [300, 100, 200]],
    ['distanceM', [30_000, 10_000, 20_000]],
    ['minAltGpsM', [900, 500, 700]],
    ['maxAltGpsM', [2_000, 1_000, 1_500]],
  ] as const)(
    'should sort %s ascending',
    (key, values) => {
      const items = [
        createItem({
          id: 'c',
          stats: { [key]: values[0] },
        }),
        createItem({
          id: 'a',
          stats: { [key]: values[1] },
        }),
        createItem({
          id: 'b',
          stats: { [key]: values[2] },
        }),
      ];

      const result = service.sort(items, {
        key,
        direction: 'asc',
      });

      expectIds(result, ['a', 'b', 'c']);
    }
  );

  it('should sort numeric values descending', () => {
    const items = [
      createItem({
        id: 'a',
        stats: { durationSec: 100 },
      }),
      createItem({
        id: 'c',
        stats: { durationSec: 300 },
      }),
      createItem({
        id: 'b',
        stats: { durationSec: 200 },
      }),
    ];

    const result = service.sort(items, {
      key: 'durationSec',
      direction: 'desc',
    });

    expectIds(result, ['c', 'b', 'a']);
  });

  it('should place missing numbers last when sorting ascending', () => {
    const items = [
      createItem({
        id: 'missing',
        stats: null,
      }),
      createItem({
        id: 'high',
        stats: { distanceM: 2_000 },
      }),
      createItem({
        id: 'low',
        stats: { distanceM: 1_000 },
      }),
    ];

    const result = service.sort(items, {
      key: 'distanceM',
      direction: 'asc',
    });

    expectIds(result, ['low', 'high', 'missing']);
  });

  it('should place missing numbers first when sorting descending', () => {
    const items = [
      createItem({
        id: 'low',
        stats: { distanceM: 1_000 },
      }),
      createItem({
        id: 'missing',
        stats: null,
      }),
      createItem({
        id: 'high',
        stats: { distanceM: 2_000 },
      }),
    ];

    const result = service.sort(items, {
      key: 'distanceM',
      direction: 'desc',
    });

    expectIds(result, ['missing', 'high', 'low']);
  });

  it('should sort sync status alphabetically', () => {
    const items = [
      createItem({ id: 'synced', syncStatus: 'synced' }),
      createItem({ id: 'remote', syncStatus: 'remoteOnly' }),
      createItem({ id: 'error', syncStatus: 'error' }),
      createItem({ id: 'local', syncStatus: 'localOnly' }),
    ];

    const result = service.sort(items, {
      key: 'syncStatus',
      direction: 'asc',
    });

    expectIds(result, ['error', 'local', 'remote', 'synced']);
  });

  it('should preserve the order of equal values', () => {
    const items = [
      createItem({ id: 'first', pilot: 'Same' }),
      createItem({ id: 'second', pilot: 'Same' }),
      createItem({ id: 'third', pilot: 'Same' }),
    ];

    const result = service.sort(items, {
      key: 'pilot',
      direction: 'asc',
    });

    expectIds(result, ['first', 'second', 'third']);
  });
});

type TestStats = Partial<{
  durationSec: number;
  distanceM: number;
  minAltGpsM: number;
  maxAltGpsM: number;
}>;

type CreateItemOptions = {
  id: string;
  local?: boolean;

  flightDate?: string | null;
  importedAtUtc?: string;

  pilot?: string | null;
  glider?: string | null;

  backendFlightDate?: string | null;
  backendPilot?: string | null;
  backendGlider?: string | null;

  stats?: TestStats | null;
  syncStatus?: FlightSyncStatus;
};

function createItem(options: CreateItemOptions): FlightListItem {
  const importedAtUtc =
    options.importedAtUtc ?? '2026-01-01T12:00:00Z';

  const localFlight =
    options.local === false
      ? null
      : {
          id: options.id,
          fileName: `${options.id}.igc`,
          flightDate: options.flightDate ?? null,
          pilot: options.pilot ?? null,
          glider: options.glider ?? null,
          importedAtUtc,
        };

  const needsBackend =
    options.local === false ||
    options.backendFlightDate !== undefined ||
    options.backendPilot !== undefined ||
    options.backendGlider !== undefined;

  const backendFlight = needsBackend
    ? ({
        id: options.id,
        fileName: `${options.id}.igc`,
        flightDate: options.backendFlightDate ?? null,
        pilot: options.backendPilot ?? null,
        glider: options.backendGlider ?? null,
        importedAtUtc,
      } as FlightListItem['backendFlight'])
    : null;

  const localStats =
    options.stats === null
      ? null
      : ({
          id: options.id,

          startIndex: 0,
          endIndex: 1,
          fixCount: 2,

          startTimeSec: 0,
          endTimeSec: options.stats?.durationSec ?? 0,
          durationSec: options.stats?.durationSec ?? 0,

          distanceM: options.stats?.distanceM ?? 0,

          minAltGpsM: options.stats?.minAltGpsM ?? 0,
          maxAltGpsM: options.stats?.maxAltGpsM ?? 0,
          gainGpsM: 0,

          minAltBaroM: 0,
          maxAltBaroM: 0,
          gainBaroM: 0,
        } satisfies NonNullable<FlightListItem['localStats']>);

  return {
    id: options.id,
    localFlight,
    backendFlight,
    localStats,
    syncStatus: options.syncStatus ?? 'localOnly',
  };
}

function expectIds(
  items: FlightListItem[],
  expectedIds: string[]
): void {
  expect(items.map((item) => item.id)).toEqual(expectedIds);
}