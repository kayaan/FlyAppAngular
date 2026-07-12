import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TrackArrays } from '../models/track-arrays.model';
import { TrackColorService } from './track-color.service';
import { TrackMathUtils } from './track-math-utils';

describe('TrackColorService', () => {
    let service: TrackColorService;

    beforeEach(() => {
        service = new TrackColorService();
        vi.restoreAllMocks();
    });

    describe('buildVarioColoredSegments', () => {
        it('should return no segments for a null track', () => {
            expect(service.buildVarioColoredSegments(null, 10)).toEqual([]);
        });

        it('should return no segments for a track with fewer than two points', () => {
            const track = createTrack({
                timeSec: [100],
                latE7: [480_000_000],
                lonE7: [110_000_000],
            });

            expect(service.buildVarioColoredSegments(track, 10)).toEqual([]);
        });

        it('should create one segment between every two track points', () => {
            const track = createTrack({
                timeSec: [100, 110, 120, 130],
                latE7: [
                    480_000_000,
                    480_001_000,
                    480_002_000,
                    480_003_000,
                ],
                lonE7: [
                    110_000_000,
                    110_001_000,
                    110_002_000,
                    110_003_000,
                ],
            });

            vi.spyOn(TrackMathUtils, 'averageVarioMs')
                .mockReturnValue(0);

            const result = service.buildVarioColoredSegments(track, 10);

            expect(result).toHaveLength(3);

            expect(result[0].points).toEqual([
                [48, 11],
                [48.0001, 11.0001],
            ]);

            expect(result[1].points).toEqual([
                [48.0001, 11.0001],
                [48.0002, 11.0002],
            ]);

            expect(result[2].points).toEqual([
                [48.0002, 11.0002],
                [48.0003, 11.0003],
            ]);
        });

        it('should use the weak climb color for zero vario', () => {
            const track = createTrack({
                timeSec: [0, 10],
            });

            vi.spyOn(TrackMathUtils, 'averageVarioMs')
                .mockReturnValue(0);

            const result = service.buildVarioColoredSegments(track, 10);

            expect(result[0].color).toBe('#00f95b');
        });

        it('should use the strongest sink color at minus four meters per second', () => {
            const track = createTrack({
                timeSec: [0, 10],
            });

            vi.spyOn(TrackMathUtils, 'averageVarioMs')
                .mockReturnValue(-4);

            const result = service.buildVarioColoredSegments(track, 10);

            expect(result[0].color).toBe('#840000');
        });

        it('should use the strongest climb color at four meters per second', () => {
            const track = createTrack({
                timeSec: [0, 10],
            });

            vi.spyOn(TrackMathUtils, 'averageVarioMs')
                .mockReturnValue(4);

            const result = service.buildVarioColoredSegments(track, 10);

            expect(result[0].color).toBe('#004e1f');
        });

        it('should clamp vario values outside the configured range', () => {
            const track = createTrack({
                timeSec: [0, 10, 20],
            });

            vi.spyOn(TrackMathUtils, 'averageVarioMs')
                .mockReturnValueOnce(-20)
                .mockReturnValueOnce(20);

            const result = service.buildVarioColoredSegments(track, 10);

            expect(result[0].color).toBe('#840000');
            expect(result[1].color).toBe('#004e1f');
        });

        it('should pass track index and resolution to TrackMathUtils', () => {
            const track = createTrack({
                timeSec: [0, 10, 20],
            });

            const spy = vi
                .spyOn(TrackMathUtils, 'averageVarioMs')
                .mockReturnValue(0);

            service.buildVarioColoredSegments(track, 15);

            expect(spy).toHaveBeenNthCalledWith(1, track, 1, 15);
            expect(spy).toHaveBeenNthCalledWith(2, track, 2, 15);
        });
    });

    describe('buildSpeedColoredSegments', () => {
        it('should return no segments for a null track', () => {
            expect(service.buildSpeedColoredSegments(null, 10)).toEqual([]);
        });

        it('should return no segments for fewer than two points', () => {
            const track = createTrack({
                timeSec: [0],
            });

            expect(service.buildSpeedColoredSegments(track, 10)).toEqual([]);
        });

        it('should use the exact configured colors at all speed stops', () => {
            const track = createTrack({
                timeSec: [0, 10, 20, 30, 40, 50, 60],
            });

            vi.spyOn(TrackMathUtils, 'averageSpeedKmh')
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(24)
                .mockReturnValueOnce(48)
                .mockReturnValueOnce(72)
                .mockReturnValueOnce(96)
                .mockReturnValueOnce(120);

            const result = service.buildSpeedColoredSegments(track, 10);

            expect(result.map((segment) => segment.color)).toEqual([
                '#1e3a8a',
                '#0ea5e9',
                '#22c55e',
                '#eab308',
                '#f97316',
                '#dc2626',
            ]);
        });

        it('should clamp speed below zero and above 120 km/h', () => {
            const track = createTrack({
                timeSec: [0, 10, 20],
            });

            vi.spyOn(TrackMathUtils, 'averageSpeedKmh')
                .mockReturnValueOnce(-50)
                .mockReturnValueOnce(200);

            const result = service.buildSpeedColoredSegments(track, 10);

            expect(result[0].color).toBe('#1e3a8a');
            expect(result[1].color).toBe('#dc2626');
        });

        it('should interpolate a color between two speed stops', () => {
            const track = createTrack({
                timeSec: [0, 10],
            });

            /*
             * 12 km/h liegt genau zwischen:
             * 0 km/h  = #1e3a8a
             * 24 km/h = #0ea5e9
             */
            vi.spyOn(TrackMathUtils, 'averageSpeedKmh')
                .mockReturnValue(12);

            const result = service.buildSpeedColoredSegments(track, 10);

            expect(result[0].color).toBe('rgb(22, 112, 186)');
        });

        it('should pass track index and resolution to TrackMathUtils', () => {
            const track = createTrack({
                timeSec: [0, 10, 20],
            });

            const spy = vi
                .spyOn(TrackMathUtils, 'averageSpeedKmh')
                .mockReturnValue(0);

            service.buildSpeedColoredSegments(track, 20);

            expect(spy).toHaveBeenNthCalledWith(1, track, 1, 20);
            expect(spy).toHaveBeenNthCalledWith(2, track, 2, 20);
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