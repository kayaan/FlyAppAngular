import { beforeEach, describe, expect, it } from 'vitest';

import { TrackArrays } from '../models/track-arrays.model';
import { FlightStatsCalculatorService } from './flight-stats-calculator.service';
import { TrackMathUtils } from './track-math-utils';

describe('FlightStatsCalculatorService', () => {
  let service: FlightStatsCalculatorService;

  beforeEach(() => {
    service = new FlightStatsCalculatorService();
  });

  it('should calculate statistics for the complete track', () => {
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
        110_001_000,
        110_002_000,
        110_003_000,
      ],
      altGpsCm: [10_000, 12_000, 11_000, 15_000],
      altBaroCm: [9_000, 11_000, 10_000, 14_000],
    });

    const result = service.calculate(track);

    const expectedDistanceM =
      TrackMathUtils.distanceMeters(
        track.latE7[0],
        track.lonE7[0],
        track.latE7[1],
        track.lonE7[1]
      ) +
      TrackMathUtils.distanceMeters(
        track.latE7[1],
        track.lonE7[1],
        track.latE7[2],
        track.lonE7[2]
      ) +
      TrackMathUtils.distanceMeters(
        track.latE7[2],
        track.lonE7[2],
        track.latE7[3],
        track.lonE7[3]
      );

    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(3);
    expect(result.fixCount).toBe(4);

    expect(result.startTimeSec).toBe(100);
    expect(result.endTimeSec).toBe(130);
    expect(result.durationSec).toBe(30);

    expect(result.distanceM).toBeCloseTo(expectedDistanceM, 8);

    expect(result.minAltGpsM).toBe(100);
    expect(result.maxAltGpsM).toBe(150);
    expect(result.gainGpsM).toBe(50);

    expect(result.minAltBaroM).toBe(90);
    expect(result.maxAltBaroM).toBe(140);
    expect(result.gainBaroM).toBe(50);
  });

  it('should calculate statistics only for the selected range', () => {
    const track = createTrack({
      timeSec: [100, 110, 120, 130, 140],
      latE7: [
        480_000_000,
        480_000_000,
        480_000_000,
        480_000_000,
        480_000_000,
      ],
      lonE7: [
        110_000_000,
        110_001_000,
        110_002_000,
        110_003_000,
        110_004_000,
      ],
      altGpsCm: [5_000, 10_000, 14_000, 12_000, 20_000],
      altBaroCm: [4_000, 9_000, 13_000, 11_000, 19_000],
    });

    const result = service.calculate(track, 1, 3);

    const expectedDistanceM =
      TrackMathUtils.distanceMeters(
        track.latE7[1],
        track.lonE7[1],
        track.latE7[2],
        track.lonE7[2]
      ) +
      TrackMathUtils.distanceMeters(
        track.latE7[2],
        track.lonE7[2],
        track.latE7[3],
        track.lonE7[3]
      );

    expect(result.startIndex).toBe(1);
    expect(result.endIndex).toBe(3);
    expect(result.fixCount).toBe(3);

    expect(result.startTimeSec).toBe(110);
    expect(result.endTimeSec).toBe(130);
    expect(result.durationSec).toBe(20);

    expect(result.distanceM).toBeCloseTo(expectedDistanceM, 8);

    expect(result.minAltGpsM).toBe(100);
    expect(result.maxAltGpsM).toBe(140);
    expect(result.gainGpsM).toBe(40);

    expect(result.minAltBaroM).toBe(90);
    expect(result.maxAltBaroM).toBe(130);
    expect(result.gainBaroM).toBe(40);
  });

  it('should return zero distance when all coordinates are identical', () => {
    const track = createTrack({
      timeSec: [100, 110, 120],
      latE7: [480_000_000, 480_000_000, 480_000_000],
      lonE7: [110_000_000, 110_000_000, 110_000_000],
      altGpsCm: [10_000, 11_000, 12_000],
      altBaroCm: [9_000, 10_000, 11_000],
    });

    const result = service.calculate(track);

    expect(result.distanceM).toBe(0);
  });

  it('should clamp negative duration to zero', () => {
    const track = createTrack({
      timeSec: [200, 100],
      latE7: [480_000_000, 480_001_000],
      lonE7: [110_000_000, 110_001_000],
      altGpsCm: [10_000, 12_000],
      altBaroCm: [9_000, 11_000],
    });

    const result = service.calculate(track);

    expect(result.startTimeSec).toBe(200);
    expect(result.endTimeSec).toBe(100);
    expect(result.durationSec).toBe(0);
  });

  it('should calculate altitude values with decimal meters', () => {
    const track = createTrack({
      timeSec: [100, 110],
      altGpsCm: [12_345, 15_678],
      altBaroCm: [11_111, 16_666],
    });

    const result = service.calculate(track);

    expect(result.minAltGpsM).toBe(123.45);
    expect(result.maxAltGpsM).toBe(156.78);
    expect(result.gainGpsM).toBeCloseTo(33.33, 10);

    expect(result.minAltBaroM).toBe(111.11);
    expect(result.maxAltBaroM).toBe(166.66);
    expect(result.gainBaroM).toBeCloseTo(55.55, 10);
  });

  it('should return empty statistics for an empty track', () => {
    const track = createTrack({});

    expect(service.calculate(track)).toEqual(emptyStats());
  });

  it('should return empty statistics for a negative start index', () => {
    const track = createTrack({
      timeSec: [100, 110, 120],
    });

    expect(service.calculate(track, -1, 2)).toEqual(emptyStats());
  });

  it('should return empty statistics when end index exceeds the track', () => {
    const track = createTrack({
      timeSec: [100, 110, 120],
    });

    expect(service.calculate(track, 0, 3)).toEqual(emptyStats());
  });

  it('should return empty statistics when start and end index are equal', () => {
    const track = createTrack({
      timeSec: [100, 110, 120],
    });

    expect(service.calculate(track, 1, 1)).toEqual(emptyStats());
  });

  it('should return empty statistics when start index is greater than end index', () => {
    const track = createTrack({
      timeSec: [100, 110, 120],
    });

    expect(service.calculate(track, 2, 1)).toEqual(emptyStats());
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

function emptyStats() {
  return {
    startIndex: 0,
    endIndex: 0,
    fixCount: 0,

    startTimeSec: 0,
    endTimeSec: 0,
    durationSec: 0,

    distanceM: 0,

    minAltGpsM: 0,
    maxAltGpsM: 0,
    gainGpsM: 0,

    minAltBaroM: 0,
    maxAltBaroM: 0,
    gainBaroM: 0,
  };
}