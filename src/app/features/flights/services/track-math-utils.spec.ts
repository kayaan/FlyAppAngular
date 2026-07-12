import { describe, expect, it } from 'vitest';

import { TrackArrays } from '../models/track-arrays.model';
import { TrackMathUtils } from './track-math-utils';

describe('TrackMathUtils', () => {
  describe('cmToM', () => {
    it('should convert centimeters to meters', () => {
      expect(TrackMathUtils.cmToM(12_345)).toBe(123.45);
      expect(TrackMathUtils.cmToM(-250)).toBe(-2.5);
      expect(TrackMathUtils.cmToM(0)).toBe(0);
    });

    it('should return null for missing or invalid values', () => {
      expect(TrackMathUtils.cmToM(null)).toBeNull();
      expect(TrackMathUtils.cmToM(undefined)).toBeNull();
      expect(TrackMathUtils.cmToM(Number.NaN)).toBeNull();
      expect(TrackMathUtils.cmToM(Number.POSITIVE_INFINITY)).toBeNull();
      expect(TrackMathUtils.cmToM(Number.NEGATIVE_INFINITY)).toBeNull();
    });
  });

  describe('e7ToDeg', () => {
    it('should convert E7 coordinates to degrees', () => {
      expect(TrackMathUtils.e7ToDeg(480_000_000)).toBe(48);
      expect(TrackMathUtils.e7ToDeg(115_825_000)).toBe(11.5825);
      expect(TrackMathUtils.e7ToDeg(-300_488_200)).toBe(-30.04882);
    });
  });

  describe('degToRad', () => {
    it('should convert degrees to radians', () => {
      expect(TrackMathUtils.degToRad(0)).toBe(0);
      expect(TrackMathUtils.degToRad(90)).toBeCloseTo(Math.PI / 2, 10);
      expect(TrackMathUtils.degToRad(180)).toBeCloseTo(Math.PI, 10);
      expect(TrackMathUtils.degToRad(-90)).toBeCloseTo(-Math.PI / 2, 10);
    });
  });

  describe('clampIndex', () => {
    it('should keep an index inside the valid range', () => {
      expect(TrackMathUtils.clampIndex(0, 10)).toBe(0);
      expect(TrackMathUtils.clampIndex(5, 10)).toBe(5);
      expect(TrackMathUtils.clampIndex(10, 10)).toBe(10);
    });

    it('should clamp an index below zero', () => {
      expect(TrackMathUtils.clampIndex(-1, 10)).toBe(0);
      expect(TrackMathUtils.clampIndex(-100, 10)).toBe(0);
    });

    it('should clamp an index above the maximum', () => {
      expect(TrackMathUtils.clampIndex(11, 10)).toBe(10);
      expect(TrackMathUtils.clampIndex(100, 10)).toBe(10);
    });
  });

  describe('haversineDistanceMFromDeg', () => {
    it('should return zero for identical coordinates', () => {
      const distanceM = TrackMathUtils.haversineDistanceMFromDeg(
        48.137154,
        11.576124,
        48.137154,
        11.576124
      );

      expect(distanceM).toBe(0);
    });

    it('should calculate a known distance', () => {
      /*
       * One degree of latitude at the equator is approximately 111.2 km.
       */
      const distanceM = TrackMathUtils.haversineDistanceMFromDeg(
        0,
        0,
        1,
        0
      );

      expect(distanceM).toBeCloseTo(111_195, -2);
    });

    it('should calculate the same distance in both directions', () => {
      const forwardDistanceM =
        TrackMathUtils.haversineDistanceMFromDeg(
          48.137154,
          11.576124,
          48.208174,
          16.373819
        );

      const backwardDistanceM =
        TrackMathUtils.haversineDistanceMFromDeg(
          48.208174,
          16.373819,
          48.137154,
          11.576124
        );

      expect(forwardDistanceM).toBeCloseTo(backwardDistanceM, 6);
    });

    it('should return zero for invalid coordinates', () => {
      expect(
        TrackMathUtils.haversineDistanceMFromDeg(
          Number.NaN,
          11,
          48,
          12
        )
      ).toBe(0);

      expect(
        TrackMathUtils.haversineDistanceMFromDeg(
          48,
          Number.POSITIVE_INFINITY,
          49,
          12
        )
      ).toBe(0);
    });
  });

  describe('haversineDistanceMFromE7', () => {
    it('should calculate distance from E7 coordinates', () => {
      const distanceM = TrackMathUtils.haversineDistanceMFromE7(
        0,
        0,
        10_000_000,
        0
      );

      expect(distanceM).toBeCloseTo(111_195, -2);
    });
  });

  describe('distanceMeters', () => {
    it('should delegate E7 distance calculation', () => {
      const distanceM = TrackMathUtils.distanceMeters(
        0,
        0,
        10_000_000,
        0
      );

      expect(distanceM).toBeCloseTo(111_195, -2);
    });
  });

  describe('findPreviousIndexByResolution', () => {
    it('should find the first index outside the requested time window', () => {
      const track = createTrack({
        timeSec: [100, 105, 110, 115, 120],
      });

      const previousIndex =
        TrackMathUtils.findPreviousIndexByResolution(
          track,
          4,
          10
        );

      expect(previousIndex).toBe(2);
    });

    it('should stop at index zero when the track is shorter than the resolution', () => {
      const track = createTrack({
        timeSec: [100, 105, 110],
      });

      const previousIndex =
        TrackMathUtils.findPreviousIndexByResolution(
          track,
          2,
          60
        );

      expect(previousIndex).toBe(0);
    });

    it('should return the current index for resolution zero', () => {
      const track = createTrack({
        timeSec: [100, 105, 110],
      });

      const previousIndex =
        TrackMathUtils.findPreviousIndexByResolution(
          track,
          2,
          0
        );

      expect(previousIndex).toBe(2);
    });

    it('should return zero for the first track point', () => {
      const track = createTrack({
        timeSec: [100, 105, 110],
      });

      const previousIndex =
        TrackMathUtils.findPreviousIndexByResolution(
          track,
          0,
          10
        );

      expect(previousIndex).toBe(0);
    });
  });

  describe('averageAltitudeM', () => {
    it('should calculate the average altitude inside the resolution window', () => {
      const track = createTrack({
        timeSec: [100, 105, 110, 115],
        altGpsCm: [10_000, 11_000, 12_000, 13_000],
      });

      const altitudeM = TrackMathUtils.averageAltitudeM(
        track,
        3,
        10
      );

      /*
       * Window starts at index 1:
       * 110 m + 120 m + 130 m = 360 m / 3 = 120 m.
       */
      expect(altitudeM).toBe(120);
    });

    it('should return the current altitude for the first point', () => {
      const track = createTrack({
        timeSec: [100],
        altGpsCm: [12_345],
      });

      const altitudeM = TrackMathUtils.averageAltitudeM(
        track,
        0,
        10
      );

      expect(altitudeM).toBe(123.45);
    });
  });

  describe('averageVarioMs', () => {
    it('should calculate positive average vario', () => {
      const track = createTrack({
        timeSec: [100, 105, 110],
        altGpsCm: [10_000, 10_500, 11_000],
      });

      const varioMs = TrackMathUtils.averageVarioMs(
        track,
        2,
        10
      );

      /*
       * Altitude gain: 10 m
       * Duration: 10 s
       */
      expect(varioMs).toBe(1);
    });

    it('should calculate negative average vario', () => {
      const track = createTrack({
        timeSec: [100, 105, 110],
        altGpsCm: [12_000, 11_500, 11_000],
      });

      const varioMs = TrackMathUtils.averageVarioMs(
        track,
        2,
        10
      );

      expect(varioMs).toBe(-1);
    });

    it('should return zero when no time has elapsed', () => {
      const track = createTrack({
        timeSec: [100, 100],
        altGpsCm: [10_000, 11_000],
      });

      const varioMs = TrackMathUtils.averageVarioMs(
        track,
        1,
        10
      );

      expect(varioMs).toBe(0);
    });

    it('should return zero when time moves backwards', () => {
      const track = createTrack({
        timeSec: [110, 100],
        altGpsCm: [10_000, 11_000],
      });

      const varioMs = TrackMathUtils.averageVarioMs(
        track,
        1,
        10
      );

      expect(varioMs).toBe(0);
    });

    it('should return zero for the first point', () => {
      const track = createTrack({
        timeSec: [100],
        altGpsCm: [10_000],
      });

      const varioMs = TrackMathUtils.averageVarioMs(
        track,
        0,
        10
      );

      expect(varioMs).toBe(0);
    });
  });

  describe('averageSpeedKmh', () => {
    it('should calculate average speed from traveled distance', () => {
      const track = createTrack({
        timeSec: [0, 10],
        latE7: [0, 0],
        lonE7: [0, 1_000],
      });

      const expectedDistanceM = TrackMathUtils.distanceMeters(
        0,
        0,
        0,
        1_000
      );

      const expectedSpeedKmh = (expectedDistanceM / 10) * 3.6;

      const speedKmh = TrackMathUtils.averageSpeedKmh(
        track,
        1,
        10
      );

      expect(speedKmh).toBeCloseTo(expectedSpeedKmh, 8);
    });

    it('should add the distances of all points in the time window', () => {
      const track = createTrack({
        timeSec: [0, 5, 10],
        latE7: [0, 0, 0],
        lonE7: [0, 500, 1_000],
      });

      const firstSegmentM = TrackMathUtils.distanceMeters(
        0,
        0,
        0,
        500
      );

      const secondSegmentM = TrackMathUtils.distanceMeters(
        0,
        500,
        0,
        1_000
      );

      const expectedSpeedKmh =
        ((firstSegmentM + secondSegmentM) / 10) * 3.6;

      const speedKmh = TrackMathUtils.averageSpeedKmh(
        track,
        2,
        10
      );

      expect(speedKmh).toBeCloseTo(expectedSpeedKmh, 8);
    });

    it('should return zero when the position does not change', () => {
      const track = createTrack({
        timeSec: [0, 10],
        latE7: [480_000_000, 480_000_000],
        lonE7: [110_000_000, 110_000_000],
      });

      const speedKmh = TrackMathUtils.averageSpeedKmh(
        track,
        1,
        10
      );

      expect(speedKmh).toBe(0);
    });

    it('should return zero when no time has elapsed', () => {
      const track = createTrack({
        timeSec: [100, 100],
        latE7: [480_000_000, 480_001_000],
        lonE7: [110_000_000, 110_001_000],
      });

      const speedKmh = TrackMathUtils.averageSpeedKmh(
        track,
        1,
        10
      );

      expect(speedKmh).toBe(0);
    });

    it('should return zero for the first point', () => {
      const track = createTrack({
        timeSec: [100],
        latE7: [480_000_000],
        lonE7: [110_000_000],
      });

      const speedKmh = TrackMathUtils.averageSpeedKmh(
        track,
        0,
        10
      );

      expect(speedKmh).toBe(0);
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