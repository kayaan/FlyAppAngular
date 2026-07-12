import { beforeEach, describe, expect, it } from 'vitest';

import { Climb } from '../models/climb.model';
import { TrackArrays } from '../models/track-arrays.model';
import { DerivedFlightStatsService } from './derived-flight-stats.service';
import { TrackMathUtils } from './track-math-utils';

describe('DerivedFlightStatsService', () => {
  let service: DerivedFlightStatsService;

  beforeEach(() => {
    service = new DerivedFlightStatsService();
  });

  it('should return null when track is null', () => {
    const result = service.derive(null, [], {
      type: 'flight',
    });

    expect(result).toBeNull();
  });

  it('should return null for an empty track', () => {
    const result = service.derive(createTrack({}), [], {
      type: 'flight',
    });

    expect(result).toBeNull();
  });

  it('should derive statistics for the complete flight', () => {
    const track = createTrack({
      timeSec: [100, 110, 120, 130],
      latE7: [
        480_000_000,
        480_000_000,
        480_000_000,
        480_000_000,
      ],
      lonE7: [
        110_000_000,
        110_000_000,
        110_000_000,
        110_000_000,
      ],
      altGpsCm: [10_000, 12_000, 11_000, 14_000],
    });

    const climbs: Climb[] = [
      createClimb(1, 0, 1),
      createClimb(2, 2, 3),
    ];

    const result = service.derive(track, climbs, {
      type: 'flight',
    });

    expect(result).not.toBeNull();

    expect(result).toMatchObject({
      scopeType: 'flight',
      scopeId: null,

      startIndex: 0,
      endIndex: 3,
      startTimeSec: 100,
      endTimeSec: 130,
      durationSec: 30,
      fixCount: 4,

      distanceM: 0,

      altitudeStartM: 100,
      altitudeEndM: 140,
      altitudeMinM: 100,
      altitudeMaxM: 140,
      altitudeDeltaM: 40,
      altitudeGainM: 50,
      altitudeLossM: 10,

      avgSpeedKmh: null,
      maxSpeedKmh: 0,

      minVarioMs: -1,
      maxVarioMs: 3,

      climbCount: 2,
    });

    expect(result?.avgVarioMs).toBeCloseTo(4 / 3, 10);
  });

  it('should derive statistics for a selected climb', () => {
    const track = createTrack({
      timeSec: [0, 10, 20, 30, 40],
      altGpsCm: [10_000, 11_000, 13_000, 12_000, 15_000],
    });

    const climbs: Climb[] = [
      createClimb(7, 1, 2),
      createClimb(8, 3, 4),
    ];

    const result = service.derive(track, climbs, {
      type: 'climb',
      climbId: 7,
    });

    expect(result).toMatchObject({
      scopeType: 'climb',
      scopeId: 7,

      startIndex: 1,
      endIndex: 2,
      startTimeSec: 10,
      endTimeSec: 20,
      durationSec: 10,
      fixCount: 2,

      altitudeStartM: 110,
      altitudeEndM: 130,
      altitudeMinM: 110,
      altitudeMaxM: 130,
      altitudeDeltaM: 20,
      altitudeGainM: 20,
      altitudeLossM: 0,

      avgVarioMs: 2,
      minVarioMs: 2,
      maxVarioMs: 2,

      climbCount: 1,
    });
  });

  it('should return null when selected climb does not exist', () => {
    const track = createTrack({
      timeSec: [0, 10],
      altGpsCm: [10_000, 12_000],
    });

    const result = service.derive(track, [], {
      type: 'climb',
      climbId: 999,
    });

    expect(result).toBeNull();
  });

  it('should derive statistics for a selected range', () => {
    const track = createTrack({
      timeSec: [0, 10, 20, 30, 40],
      altGpsCm: [10_000, 12_000, 11_000, 14_000, 13_000],
    });

    const climbs: Climb[] = [
      createClimb(1, 0, 1),
      createClimb(2, 1, 3),
      createClimb(3, 3, 4),
    ];

    const result = service.derive(track, climbs, {
      type: 'range',
      startIndex: 1,
      endIndex: 3,
    });

    expect(result).toMatchObject({
      scopeType: 'range',
      scopeId: null,

      startIndex: 1,
      endIndex: 3,
      startTimeSec: 10,
      endTimeSec: 30,
      durationSec: 20,
      fixCount: 3,

      altitudeStartM: 120,
      altitudeEndM: 140,
      altitudeMinM: 110,
      altitudeMaxM: 140,
      altitudeDeltaM: 20,
      altitudeGainM: 30,
      altitudeLossM: 10,

      avgVarioMs: 1,
      minVarioMs: -1,
      maxVarioMs: 3,

      climbCount: 1,
    });
  });

  it('should normalize a reversed range', () => {
    const track = createTrack({
      timeSec: [0, 10, 20, 30],
      altGpsCm: [10_000, 11_000, 12_000, 13_000],
    });

    const result = service.derive(track, [], {
      type: 'range',
      startIndex: 3,
      endIndex: 1,
    });

    expect(result?.startIndex).toBe(1);
    expect(result?.endIndex).toBe(3);
    expect(result?.startTimeSec).toBe(10);
    expect(result?.endTimeSec).toBe(30);
  });

  it('should clamp range indices to the track', () => {
    const track = createTrack({
      timeSec: [100, 110, 120],
      altGpsCm: [10_000, 11_000, 12_000],
    });

    const result = service.derive(track, [], {
      type: 'range',
      startIndex: -10,
      endIndex: 100,
    });

    expect(result?.startIndex).toBe(0);
    expect(result?.endIndex).toBe(2);
    expect(result?.fixCount).toBe(3);
  });

  it('should calculate distance and speed', () => {
    const track = createTrack({
      timeSec: [0, 10, 20],
      latE7: [
        480_000_000,
        480_000_000,
        480_000_000,
      ],
      lonE7: [
        110_000_000,
        110_001_000,
        110_003_000,
      ],
      altGpsCm: [10_000, 10_000, 10_000],
    });

    const firstDistanceM = TrackMathUtils.distanceMeters(
      track.latE7[0],
      track.lonE7[0],
      track.latE7[1],
      track.lonE7[1]
    );

    const secondDistanceM = TrackMathUtils.distanceMeters(
      track.latE7[1],
      track.lonE7[1],
      track.latE7[2],
      track.lonE7[2]
    );

    const totalDistanceM = firstDistanceM + secondDistanceM;

    const result = service.derive(track, [], {
      type: 'flight',
    });

    expect(result?.distanceM).toBeCloseTo(totalDistanceM, 8);

    expect(result?.avgSpeedKmh).toBeCloseTo(
      (totalDistanceM / 20) * 3.6,
      8
    );

    expect(result?.maxSpeedKmh).toBeCloseTo(
      (secondDistanceM / 10) * 3.6,
      8
    );
  });

  it('should ignore non-positive time differences for vario and speed', () => {
    const track = createTrack({
      timeSec: [100, 100, 90],
      latE7: [
        480_000_000,
        480_001_000,
        480_002_000,
      ],
      lonE7: [
        110_000_000,
        110_001_000,
        110_002_000,
      ],
      altGpsCm: [10_000, 12_000, 15_000],
    });

    const result = service.derive(track, [], {
      type: 'flight',
    });

    expect(result?.durationSec).toBe(0);

    expect(result?.avgVarioMs).toBeNull();
    expect(result?.minVarioMs).toBeNull();
    expect(result?.maxVarioMs).toBeNull();

    expect(result?.avgSpeedKmh).toBeNull();
    expect(result?.maxSpeedKmh).toBeNull();

    /*
     * Höhengewinn wird unabhängig von gültigen Zeitabständen
     * aus den aufeinanderfolgenden Höhen berechnet.
     */
    expect(result?.altitudeGainM).toBe(50);
    expect(result?.altitudeLossM).toBe(0);
  });

  it('should derive valid statistics for a single-point range', () => {
    const track = createTrack({
      timeSec: [100, 110, 120],
      altGpsCm: [10_000, 12_345, 15_000],
    });

    const result = service.derive(track, [], {
      type: 'range',
      startIndex: 1,
      endIndex: 1,
    });

    expect(result).toMatchObject({
      startIndex: 1,
      endIndex: 1,
      startTimeSec: 110,
      endTimeSec: 110,
      durationSec: 0,
      fixCount: 1,

      distanceM: 0,

      altitudeStartM: 123.45,
      altitudeEndM: 123.45,
      altitudeMinM: 123.45,
      altitudeMaxM: 123.45,
      altitudeDeltaM: 0,
      altitudeGainM: 0,
      altitudeLossM: 0,

      avgSpeedKmh: null,
      maxSpeedKmh: null,

      avgVarioMs: null,
      minVarioMs: null,
      maxVarioMs: null,

      climbCount: 0,
    });
  });
});

type TrackValues = {
  timeSec?: number[];
  latE7?: number[];
  lonE7?: number[];
  altGpsCm?: number[];
  altBaroCm?: number[];
};

function createTrack(values: TrackValues): TrackArrays {
  const pointCount = Math.max(
    values.timeSec?.length ?? 0,
    values.latE7?.length ?? 0,
    values.lonE7?.length ?? 0,
    values.altGpsCm?.length ?? 0,
    values.altBaroCm?.length ?? 0
  );

  return {
    timeSec: new Int32Array(
      values.timeSec ?? new Array(pointCount).fill(0)
    ),
    latE7: new Int32Array(
      values.latE7 ?? new Array(pointCount).fill(0)
    ),
    lonE7: new Int32Array(
      values.lonE7 ?? new Array(pointCount).fill(0)
    ),
    altGpsCm: new Int32Array(
      values.altGpsCm ?? new Array(pointCount).fill(0)
    ),
    altBaroCm: new Int32Array(
      values.altBaroCm ?? new Array(pointCount).fill(0)
    ),
  };
}

function createClimb(
  id: number,
  startIndex: number,
  endIndex: number
): Climb {
  return {
    id,
    flightId: 'flight-1',

    startIndex,
    endIndex,
    peakIndex: endIndex,

    startTimeSec: 0,
    endTimeSec: 0,
    durationSec: 0,

    gainM: 0,
    avgClimbMs: 0,
    maxClimbMs: 0,
  };
}