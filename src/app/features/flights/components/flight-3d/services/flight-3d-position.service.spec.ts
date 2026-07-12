import { beforeEach, describe, expect, it } from 'vitest';

import { TrackArrays } from '../../../models/track-arrays.model';
import {
  Flight3dPositionOptions,
  Flight3dPositionService,
} from './flight-3d-position.service';

describe('Flight3dPositionService', () => {
  let service: Flight3dPositionService;

  const defaultOptions: Flight3dPositionOptions = {
    trackAltitudeOffsetM: 100,
    verticalExaggeration: 2,
    verticalExaggerationRelativeHeight: 500,
  };

  beforeEach(() => {
    service = new Flight3dPositionService();
  });

  describe('getPointCount', () => {
    it('should return zero for an empty track', () => {
      expect(service.getPointCount(createTrack({}))).toBe(0);
    });

    it('should return the shortest required array length', () => {
      const track: TrackArrays = {
        timeSec: new Int32Array([0, 10, 20, 30]),
        latE7: new Int32Array([480_000_000, 481_000_000]),
        lonE7: new Int32Array([
          110_000_000,
          111_000_000,
          112_000_000,
        ]),
        altGpsCm: new Int32Array([
          10_000,
          11_000,
          12_000,
          13_000,
        ]),
        altBaroCm: new Int32Array([9_000]),
      };

      expect(service.getPointCount(track)).toBe(2);
    });

    it('should ignore barometric altitude length', () => {
      const track: TrackArrays = {
        timeSec: new Int32Array([0, 10, 20]),
        latE7: new Int32Array([
          480_000_000,
          481_000_000,
          482_000_000,
        ]),
        lonE7: new Int32Array([
          110_000_000,
          111_000_000,
          112_000_000,
        ]),
        altGpsCm: new Int32Array([
          10_000,
          11_000,
          12_000,
        ]),
        altBaroCm: new Int32Array(),
      };

      expect(service.getPointCount(track)).toBe(3);
    });
  });

  describe('clampIndex', () => {
    const track = createTrack({
      timeSec: [0, 10, 20],
      latE7: [480_000_000, 481_000_000, 482_000_000],
      lonE7: [110_000_000, 111_000_000, 112_000_000],
      altGpsCm: [10_000, 11_000, 12_000],
    });

    it('should preserve an index inside the track', () => {
      expect(service.clampIndex(track, 1)).toBe(1);
    });

    it('should clamp a negative index to zero', () => {
      expect(service.clampIndex(track, -10)).toBe(0);
    });

    it('should clamp an index above the final point', () => {
      expect(service.clampIndex(track, 100)).toBe(2);
    });

    it('should return zero for an empty track', () => {
      expect(service.clampIndex(createTrack({}), 100)).toBe(0);
    });
  });

  describe('exaggerateHeight', () => {
    it('should exaggerate height relative to the configured base height', () => {
      const result = service.exaggerateHeight(
        700,
        defaultOptions
      );

      /*
       * 100 offset
       * + 500 reference height
       * + (700 - 500) * 2
       * = 1000 m
       */
      expect(result).toBe(1_000);
    });

    it('should preserve relative height when exaggeration is one', () => {
      const result = service.exaggerateHeight(700, {
        trackAltitudeOffsetM: 100,
        verticalExaggeration: 1,
        verticalExaggerationRelativeHeight: 500,
      });

      expect(result).toBe(800);
    });

    it('should apply only the offset when exaggeration is zero', () => {
      const result = service.exaggerateHeight(700, {
        trackAltitudeOffsetM: 100,
        verticalExaggeration: 0,
        verticalExaggerationRelativeHeight: 500,
      });

      expect(result).toBe(600);
    });

    it('should support heights below the relative base', () => {
      const result = service.exaggerateHeight(
        300,
        defaultOptions
      );

      expect(result).toBe(200);
    });
  });

  describe('buildPosition', () => {
    it('should return null for an empty track', () => {
      const result = service.buildPosition(
        createTrack({}),
        0,
        defaultOptions
      );

      expect(result).toBeNull();
    });

    it('should build a Cesium position for a valid point', () => {
      const track = createTrack({
        timeSec: [0],
        latE7: [480_000_000],
        lonE7: [110_000_000],
        altGpsCm: [70_000],
      });

      const result = service.buildPosition(
        track,
        0,
        defaultOptions
      );

      expect(result).not.toBeNull();
      expect(result?.x).toBeTypeOf('number');
      expect(result?.y).toBeTypeOf('number');
      expect(result?.z).toBeTypeOf('number');

      expect(Number.isFinite(result?.x)).toBe(true);
      expect(Number.isFinite(result?.y)).toBe(true);
      expect(Number.isFinite(result?.z)).toBe(true);
    });

    it('should clamp a negative index to the first point', () => {
      const track = createTrack({
        timeSec: [0, 10],
        latE7: [480_000_000, 490_000_000],
        lonE7: [110_000_000, 120_000_000],
        altGpsCm: [50_000, 60_000],
      });

      const first = service.buildPosition(
        track,
        0,
        defaultOptions
      );

      const clamped = service.buildPosition(
        track,
        -100,
        defaultOptions
      );

      expect(clamped).toEqual(first);
    });

    it('should clamp an index above the track to the final point', () => {
      const track = createTrack({
        timeSec: [0, 10],
        latE7: [480_000_000, 490_000_000],
        lonE7: [110_000_000, 120_000_000],
        altGpsCm: [50_000, 60_000],
      });

      const last = service.buildPosition(
        track,
        1,
        defaultOptions
      );

      const clamped = service.buildPosition(
        track,
        100,
        defaultOptions
      );

      expect(clamped).toEqual(last);
    });

    it('should return null for coordinate zero zero', () => {
      const track = createTrack({
        timeSec: [0],
        latE7: [0],
        lonE7: [0],
        altGpsCm: [50_000],
      });

      expect(
        service.buildPosition(track, 0, defaultOptions)
      ).toBeNull();
    });

    it('should allow zero latitude when longitude is valid', () => {
      const track = createTrack({
        timeSec: [0],
        latE7: [0],
        lonE7: [100_000_000],
        altGpsCm: [50_000],
      });

      expect(
        service.buildPosition(track, 0, defaultOptions)
      ).not.toBeNull();
    });

    it('should allow zero longitude when latitude is valid', () => {
      const track = createTrack({
        timeSec: [0],
        latE7: [480_000_000],
        lonE7: [0],
        altGpsCm: [50_000],
      });

      expect(
        service.buildPosition(track, 0, defaultOptions)
      ).not.toBeNull();
    });

    it('should use GPS altitude in centimeters', () => {
      const track = createTrack({
        timeSec: [0],
        latE7: [480_000_000],
        lonE7: [110_000_000],
        altGpsCm: [70_000],
      });

      const result = service.buildPosition(track, 0, {
        trackAltitudeOffsetM: 0,
        verticalExaggeration: 1,
        verticalExaggerationRelativeHeight: 0,
      });

      expect(result).not.toBeNull();

      const lowerPosition = service.buildPosition(
        {
          ...track,
          altGpsCm: new Int32Array([60_000]),
        },
        0,
        {
          trackAltitudeOffsetM: 0,
          verticalExaggeration: 1,
          verticalExaggerationRelativeHeight: 0,
        }
      );

      expect(lowerPosition).not.toBeNull();
      expect(result).not.toEqual(lowerPosition);
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