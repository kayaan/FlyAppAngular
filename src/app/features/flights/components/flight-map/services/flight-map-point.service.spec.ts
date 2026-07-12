import { beforeEach, describe, expect, it } from 'vitest';

import { TrackArrays } from '../../../models/track-arrays.model';
import { FlightMapPointService } from './flight-map-point.service';

describe('FlightMapPointService', () => {
  let service: FlightMapPointService;

  beforeEach(() => {
    service = new FlightMapPointService();
  });

  describe('buildPoint', () => {
    it('should return null for an empty track', () => {
      const track = createTrack({});

      expect(service.buildPoint(track, 0)).toBeNull();
    });

    it('should convert E7 coordinates to latitude and longitude', () => {
      const track = createTrack({
        timeSec: [100],
        latE7: [481_234_567],
        lonE7: [112_345_678],
      });

      expect(service.buildPoint(track, 0)).toEqual([
        48.1234567,
        11.2345678,
      ]);
    });

    it('should preserve negative coordinates', () => {
      const track = createTrack({
        timeSec: [100],
        latE7: [-377_703_333],
        lonE7: [-300_813_667],
      });

      expect(service.buildPoint(track, 0)).toEqual([
        -37.7703333,
        -30.0813667,
      ]);
    });

    it('should clamp a negative index to the first point', () => {
      const track = createTrack({
        timeSec: [100, 110],
        latE7: [480_000_000, 490_000_000],
        lonE7: [110_000_000, 120_000_000],
      });

      expect(service.buildPoint(track, -10)).toEqual([
        48,
        11,
      ]);
    });

    it('should clamp an index above the track to the last point', () => {
      const track = createTrack({
        timeSec: [100, 110],
        latE7: [480_000_000, 490_000_000],
        lonE7: [110_000_000, 120_000_000],
      });

      expect(service.buildPoint(track, 100)).toEqual([
        49,
        12,
      ]);
    });

    it('should return null for coordinate zero zero', () => {
      const track = createTrack({
        timeSec: [100],
        latE7: [0],
        lonE7: [0],
      });

      expect(service.buildPoint(track, 0)).toBeNull();
    });

    it('should accept a zero latitude when longitude is non-zero', () => {
      const track = createTrack({
        timeSec: [100],
        latE7: [0],
        lonE7: [100_000_000],
      });

      expect(service.buildPoint(track, 0)).toEqual([
        0,
        10,
      ]);
    });

    it('should accept a zero longitude when latitude is non-zero', () => {
      const track = createTrack({
        timeSec: [100],
        latE7: [480_000_000],
        lonE7: [0],
      });

      expect(service.buildPoint(track, 0)).toEqual([
        48,
        0,
      ]);
    });

    it('should use the shortest required track array as point count', () => {
      const track: TrackArrays = {
        timeSec: new Int32Array([100, 110, 120]),
        latE7: new Int32Array([
          480_000_000,
          490_000_000,
        ]),
        lonE7: new Int32Array([
          110_000_000,
          120_000_000,
          130_000_000,
        ]),
        altGpsCm: new Int32Array(3),
        altBaroCm: new Int32Array(3),
      };

      expect(service.buildPoint(track, 2)).toEqual([
        49,
        12,
      ]);
    });
  });

  describe('buildTrackPoints', () => {
    it('should return an empty array for an empty track', () => {
      expect(
        service.buildTrackPoints(createTrack({}), 0, 10)
      ).toEqual([]);
    });

    it('should build all points in the requested inclusive range', () => {
      const track = createTrack({
        timeSec: [100, 110, 120, 130],
        latE7: [
          480_000_000,
          481_000_000,
          482_000_000,
          483_000_000,
        ],
        lonE7: [
          110_000_000,
          111_000_000,
          112_000_000,
          113_000_000,
        ],
      });

      const result = service.buildTrackPoints(track, 1, 3);

      expect(result).toEqual([
        [48.1, 11.1],
        [48.2, 11.2],
        [48.3, 11.3],
      ]);
    });

    it('should support a reversed index range', () => {
      const track = createTrack({
        timeSec: [100, 110, 120, 130],
        latE7: [
          480_000_000,
          481_000_000,
          482_000_000,
          483_000_000,
        ],
        lonE7: [
          110_000_000,
          111_000_000,
          112_000_000,
          113_000_000,
        ],
      });

      const result = service.buildTrackPoints(track, 3, 1);

      expect(result).toEqual([
        [48.1, 11.1],
        [48.2, 11.2],
        [48.3, 11.3],
      ]);
    });

    it('should clamp a negative start index to zero', () => {
      const track = createTrack({
        timeSec: [100, 110, 120],
        latE7: [
          480_000_000,
          481_000_000,
          482_000_000,
        ],
        lonE7: [
          110_000_000,
          111_000_000,
          112_000_000,
        ],
      });

      const result = service.buildTrackPoints(track, -10, 1);

      expect(result).toEqual([
        [48, 11],
        [48.1, 11.1],
      ]);
    });

    it('should clamp the end index to the final point', () => {
      const track = createTrack({
        timeSec: [100, 110, 120],
        latE7: [
          480_000_000,
          481_000_000,
          482_000_000,
        ],
        lonE7: [
          110_000_000,
          111_000_000,
          112_000_000,
        ],
      });

      const result = service.buildTrackPoints(track, 1, 100);

      expect(result).toEqual([
        [48.1, 11.1],
        [48.2, 11.2],
      ]);
    });

    it('should skip zero-zero coordinates', () => {
      const track = createTrack({
        timeSec: [100, 110, 120],
        latE7: [
          480_000_000,
          0,
          482_000_000,
        ],
        lonE7: [
          110_000_000,
          0,
          112_000_000,
        ],
      });

      const result = service.buildTrackPoints(track, 0, 2);

      expect(result).toEqual([
        [48, 11],
        [48.2, 11.2],
      ]);
    });

    it('should return an empty array when the complete range is above the track', () => {
      const track = createTrack({
        timeSec: [100, 110],
        latE7: [480_000_000, 490_000_000],
        lonE7: [110_000_000, 120_000_000],
      });

      expect(
        service.buildTrackPoints(track, 10, 20)
      ).toEqual([]);
    });

    it('should return an empty array when the complete range is negative', () => {
      const track = createTrack({
        timeSec: [100, 110],
        latE7: [480_000_000, 490_000_000],
        lonE7: [110_000_000, 120_000_000],
      });

      expect(
        service.buildTrackPoints(track, -20, -10)
      ).toEqual([]);
    });

    it('should limit points using the shortest required array', () => {
      const track: TrackArrays = {
        timeSec: new Int32Array([100, 110, 120, 130]),
        latE7: new Int32Array([
          480_000_000,
          481_000_000,
        ]),
        lonE7: new Int32Array([
          110_000_000,
          111_000_000,
          112_000_000,
        ]),
        altGpsCm: new Int32Array(4),
        altBaroCm: new Int32Array(4),
      };

      const result = service.buildTrackPoints(track, 0, 10);

      expect(result).toEqual([
        [48, 11],
        [48.1, 11.1],
      ]);
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