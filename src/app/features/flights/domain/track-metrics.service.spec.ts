import { beforeEach, describe, expect, it } from 'vitest';

import { TrackArrays } from '../models/track-arrays.model';
import { TrackMetricsService } from './track-metrics.service';
import { TrackMathUtils } from './track-math-utils';

describe('TrackMetricsService', () => {
  let service: TrackMetricsService;

  beforeEach(() => {
    service = new TrackMetricsService();
  });

  it('should return empty metric arrays for an empty track', () => {
    const track = createTrack({});

    const result = service.build(track, 10, 10, 10);

    expect(result.altitudeM).toBeInstanceOf(Float32Array);
    expect(result.varioMs).toBeInstanceOf(Float32Array);
    expect(result.speedKmh).toBeInstanceOf(Float32Array);

    expect(result.altitudeM.length).toBe(0);
    expect(result.varioMs.length).toBe(0);
    expect(result.speedKmh.length).toBe(0);
  });

  it('should build one metric value for every track point', () => {
    const track = createTrack({
      timeSec: [0, 5, 10, 15],
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
      altGpsCm: [10_000, 10_500, 11_000, 11_500],
    });

    const result = service.build(track, 10, 10, 10);

    expect(result.altitudeM.length).toBe(4);
    expect(result.varioMs.length).toBe(4);
    expect(result.speedKmh.length).toBe(4);
  });

  it('should calculate altitude values using the altitude resolution', () => {
    const track = createTrack({
      timeSec: [0, 5, 10, 15],
      altGpsCm: [10_000, 11_000, 12_000, 13_000],
    });

    const result = service.build(
      track,
      10,
      0,
      0
    );

    /*
     * Index 0:
     * 100 m
     *
     * Index 1:
     * resolution starts before track start,
     * average of 100 m and 110 m = 105 m
     *
     * Index 2:
     * findPreviousIndexByResolution() includes index 0,
     * average of 100 m, 110 m and 120 m = 110 m
     *
     * Index 3:
     * window begins at index 1,
     * average of 110 m, 120 m and 130 m = 120 m
     */
    expectArrayCloseTo(result.altitudeM, [
      100,
      105,
      110,
      120,
    ]);
  });

  it('should calculate positive and negative vario values', () => {
    const track = createTrack({
      timeSec: [0, 5, 10, 15],
      altGpsCm: [10_000, 10_500, 11_000, 10_000],
    });

    const result = service.build(
      track,
      0,
      5,
      0
    );

    expect(result.varioMs[0]).toBe(0);
    expect(result.varioMs[1]).toBeCloseTo(1, 6);
    expect(result.varioMs[2]).toBeCloseTo(1, 6);
    expect(result.varioMs[3]).toBeCloseTo(-2, 6);
  });

  it('should calculate speed values using the speed resolution', () => {
    const track = createTrack({
      timeSec: [0, 5, 10],
      latE7: [480_000_000, 480_000_000, 480_000_000],
      lonE7: [110_000_000, 110_001_000, 110_002_000],
      altGpsCm: [10_000, 10_000, 10_000],
    });

    const result = service.build(
      track,
      0,
      0,
      10
    );

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

    const expectedFirstSpeedKmh =
      (firstDistanceM / 5) * 3.6;

    const expectedSecondSpeedKmh =
      ((firstDistanceM + secondDistanceM) / 10) * 3.6;

    expect(result.speedKmh[0]).toBe(0);
    expect(result.speedKmh[1]).toBeCloseTo(
      expectedFirstSpeedKmh,
      4
    );
    expect(result.speedKmh[2]).toBeCloseTo(
      expectedSecondSpeedKmh,
      4
    );
  });

  it('should use different resolutions independently', () => {
    const track = createTrack({
      timeSec: [0, 5, 10],
      latE7: [480_000_000, 480_000_000, 480_000_000],
      lonE7: [110_000_000, 110_001_000, 110_002_000],
      altGpsCm: [10_000, 11_000, 14_000],
    });

    const result = service.build(
      track,
      10,
      5,
      10
    );

    expect(result.altitudeM[2]).toBeCloseTo(
      (100 + 110 + 140) / 3,
      4
    );

    expect(result.varioMs[2]).toBeCloseTo(
      (140 - 110) / 5,
      4
    );

    const distanceM =
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
      );

    expect(result.speedKmh[2]).toBeCloseTo(
      (distanceM / 10) * 3.6,
      4
    );
  });

  it('should return zero vario and speed for the first point', () => {
    const track = createTrack({
      timeSec: [100],
      latE7: [480_000_000],
      lonE7: [110_000_000],
      altGpsCm: [12_345],
    });

    const result = service.build(track, 10, 10, 10);

    expect(result.altitudeM[0]).toBeCloseTo(123.45, 2);
    expect(result.varioMs[0]).toBe(0);
    expect(result.speedKmh[0]).toBe(0);
  });

  it('should return zero vario and speed when timestamps are equal', () => {
    const track = createTrack({
      timeSec: [100, 100],
      latE7: [480_000_000, 480_001_000],
      lonE7: [110_000_000, 110_001_000],
      altGpsCm: [10_000, 12_000],
    });

    const result = service.build(track, 10, 10, 10);

    expect(result.varioMs[1]).toBe(0);
    expect(result.speedKmh[1]).toBe(0);
  });

  it('should use the shortest required track array as point count', () => {
    const track: TrackArrays = {
      timeSec: new Int32Array([0, 5, 10, 15]),
      latE7: new Int32Array([
        480_000_000,
        480_000_000,
        480_000_000,
      ]),
      lonE7: new Int32Array([
        110_000_000,
        110_001_000,
        110_002_000,
        110_003_000,
      ]),
      altGpsCm: new Int32Array([
        10_000,
        11_000,
        12_000,
        13_000,
      ]),
      altBaroCm: new Int32Array([9_000]),
    };

    const result = service.build(track, 10, 10, 10);

    /*
     * latE7 has only three entries. altBaroCm is not used
     * by TrackMetricsService and therefore does not limit
     * the point count.
     */
    expect(result.altitudeM.length).toBe(3);
    expect(result.varioMs.length).toBe(3);
    expect(result.speedKmh.length).toBe(3);
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

function expectArrayCloseTo(
  actual: Float32Array,
  expected: number[],
  precision = 4
): void {
  expect(actual.length).toBe(expected.length);

  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, precision);
  });
}