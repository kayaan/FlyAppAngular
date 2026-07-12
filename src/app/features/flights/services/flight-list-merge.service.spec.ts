import { beforeEach, describe, expect, it } from 'vitest';

import { LocalFlightListItem } from '../data-access/flight-storage.interface';
import { BackendFlight } from '../models/backend-flight.model';
import { FlightStats } from '../models/flight-stats.model';
import { Flight } from '../models/flight.model';
import { FlightListMergeService } from './flight-list-merge.service';

describe('FlightListMergeService', () => {
  let service: FlightListMergeService;

  beforeEach(() => {
    service = new FlightListMergeService();
  });

  it('should return an empty array when both sources are empty', () => {
    const result = service.merge([], []);

    expect(result).toEqual([]);
  });

  it('should map local flights to localOnly items', () => {
    const localFlight = createLocalFlight('local-1');
    const localStats = createStats('local-1');

    const localItems: LocalFlightListItem[] = [
      {
        flight: localFlight,
        stats: localStats,
      },
    ];

    const result = service.merge(localItems, []);

    expect(result).toEqual([
      {
        id: 'local-1',
        localFlight,
        backendFlight: null,
        localStats,
        syncStatus: 'localOnly',
      },
    ]);
  });

  it('should map backend flights to remoteOnly items', () => {
    const backendFlight = createBackendFlight('remote-1');

    const result = service.merge([], [backendFlight]);

    expect(result).toEqual([
      {
        id: 'remote-1',
        localFlight: null,
        backendFlight,
        localStats: null,
        syncStatus: 'remoteOnly',
      },
    ]);
  });

  it('should merge local and backend flights with the same id', () => {
    const localFlight = createLocalFlight('shared-1');
    const localStats = createStats('shared-1');
    const backendFlight = createBackendFlight('shared-1');

    const localItems: LocalFlightListItem[] = [
      {
        flight: localFlight,
        stats: localStats,
      },
    ];

    const result = service.merge(localItems, [backendFlight]);

    expect(result).toEqual([
      {
        id: 'shared-1',
        localFlight,
        backendFlight,
        localStats,
        syncStatus: 'synced',
      },
    ]);
  });

  it('should merge mixed local and backend flights correctly', () => {
    const localOnlyFlight = createLocalFlight('local-only');
    const sharedLocalFlight = createLocalFlight('shared');
    const sharedStats = createStats('shared');

    const sharedBackendFlight = createBackendFlight('shared');
    const remoteOnlyFlight = createBackendFlight('remote-only');

    const localItems: LocalFlightListItem[] = [
      {
        flight: localOnlyFlight,
        stats: createStats('local-only'),
      },
      {
        flight: sharedLocalFlight,
        stats: sharedStats,
      },
    ];

    const backendFlights: BackendFlight[] = [
      sharedBackendFlight,
      remoteOnlyFlight,
    ];

    const result = service.merge(localItems, backendFlights);

    expect(result).toHaveLength(3);

    expect(result[0]).toMatchObject({
      id: 'local-only',
      syncStatus: 'localOnly',
      localFlight: localOnlyFlight,
      backendFlight: null,
    });

    expect(result[1]).toMatchObject({
      id: 'shared',
      syncStatus: 'synced',
      localFlight: sharedLocalFlight,
      backendFlight: sharedBackendFlight,
      localStats: sharedStats,
    });

    expect(result[2]).toMatchObject({
      id: 'remote-only',
      syncStatus: 'remoteOnly',
      localFlight: null,
      backendFlight: remoteOnlyFlight,
      localStats: null,
    });
  });

  it('should preserve local statistics when a matching backend flight exists', () => {
    const stats = createStats('flight-1');

    const result = service.merge(
      [
        {
          flight: createLocalFlight('flight-1'),
          stats,
        },
      ],
      [createBackendFlight('flight-1')]
    );

    expect(result[0].localStats).toBe(stats);
  });

  it('should not mutate the input arrays', () => {
    const localItems: LocalFlightListItem[] = [
      {
        flight: createLocalFlight('local-1'),
        stats: createStats('local-1'),
      },
    ];

    const backendFlights: BackendFlight[] = [
      createBackendFlight('remote-1'),
    ];

    const originalLocalItems = [...localItems];
    const originalBackendFlights = [...backendFlights];

    service.merge(localItems, backendFlights);

    expect(localItems).toEqual(originalLocalItems);
    expect(backendFlights).toEqual(originalBackendFlights);
  });

  it('should use the last local item when duplicate local ids exist', () => {
    const firstFlight = createLocalFlight('duplicate', {
      pilot: 'First Pilot',
    });

    const secondFlight = createLocalFlight('duplicate', {
      pilot: 'Second Pilot',
    });

    const result = service.merge(
      [
        {
          flight: firstFlight,
          stats: createStats('duplicate'),
        },
        {
          flight: secondFlight,
          stats: createStats('duplicate'),
        },
      ],
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].localFlight).toBe(secondFlight);
    expect(result[0].localFlight?.pilot).toBe('Second Pilot');
  });

  it('should use the last backend flight when duplicate backend ids exist', () => {
    const firstBackendFlight = createBackendFlight('duplicate', {
      pilot: 'First Pilot',
    });

    const secondBackendFlight = createBackendFlight('duplicate', {
      pilot: 'Second Pilot',
    });

    const result = service.merge(
      [],
      [firstBackendFlight, secondBackendFlight]
    );

    expect(result).toHaveLength(1);
    expect(result[0].backendFlight).toBe(secondBackendFlight);
    expect(result[0].backendFlight?.pilot).toBe('Second Pilot');
  });
});

type FlightOverrides = Partial<Flight>;

function createLocalFlight(
  id: string,
  overrides: FlightOverrides = {}
): Flight {
  return {
    id,
    fileName: `${id}.igc`,
    flightDate: '2026-07-01',
    pilot: 'Local Pilot',
    glider: 'Local Glider',
    importedAtUtc: '2026-07-01T12:00:00Z',
    ...overrides,
  };
}

type BackendFlightOverrides = Partial<BackendFlight>;

function createBackendFlight(
  id: string,
  overrides: BackendFlightOverrides = {}
): BackendFlight {
  return {
    id,
    fileName: `${id}.igc`,
    flightDate: '2026-07-01',
    pilot: 'Backend Pilot',
    glider: 'Backend Glider',
    visibility: 'PRIVATE',
    importedAtUtc: '2026-07-01T12:00:00Z',
    createdAtUtc: '2026-07-01T12:00:00Z',
    updatedAtUtc: '2026-07-01T12:00:00Z',
    ...overrides,
  };
}

function createStats(id: string): FlightStats {
  return {
    id,

    startIndex: 0,
    endIndex: 2,
    fixCount: 3,

    startTimeSec: 100,
    endTimeSec: 120,
    durationSec: 20,

    distanceM: 1_000,

    minAltGpsM: 500,
    maxAltGpsM: 700,
    gainGpsM: 200,

    minAltBaroM: 490,
    maxAltBaroM: 690,
    gainBaroM: 200,
  };
}