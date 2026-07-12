import { beforeEach, describe, expect, it } from 'vitest';

import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';

describe('FlightLineChartTimeService', () => {
    let service: FlightLineChartTimeService;

    beforeEach(() => {
        service = new FlightLineChartTimeService();
    });

    describe('getFirstTimeSec', () => {
        it('should return zero for empty data', () => {
            expect(service.getFirstTimeSec([])).toBe(0);
        });

        it('should return the time of the first point', () => {
            const data = createData([
                [5, 10_000],
                [8, 10_010],
            ]);

            expect(service.getFirstTimeSec(data)).toBe(10_000);
        });

        it('should use array order and not the smallest time', () => {
            const data = createData([
                [5, 200],
                [8, 100],
            ]);

            expect(service.getFirstTimeSec(data)).toBe(200);
        });
    });

    describe('getMaxElapsedSec', () => {
        it('should return zero for empty data', () => {
            expect(service.getMaxElapsedSec([])).toBe(0);
        });

        it('should calculate elapsed time between first and last point', () => {
            const data = createData([
                [0, 100],
                [1, 110],
                [2, 135],
            ]);

            expect(service.getMaxElapsedSec(data)).toBe(35);
        });

        it('should clamp a negative elapsed time to zero', () => {
            const data = createData([
                [0, 200],
                [1, 150],
            ]);

            expect(service.getMaxElapsedSec(data)).toBe(0);
        });

        it('should return zero for one point', () => {
            const data = createData([
                [0, 100],
            ]);

            expect(service.getMaxElapsedSec(data)).toBe(0);
        });
    });

    describe('getElapsedSecForTrackIndex', () => {
        it('should return null when the track index does not exist', () => {
            const data = createData([
                [10, 100],
                [20, 110],
            ]);

            expect(
                service.getElapsedSecForTrackIndex(data, 999)
            ).toBeNull();
        });

        it('should return zero for the first track point', () => {
            const data = createData([
                [10, 100],
                [20, 110],
            ]);

            expect(
                service.getElapsedSecForTrackIndex(data, 10)
            ).toBe(0);
        });

        it('should calculate elapsed time for the matching track index', () => {
            const data = createData([
                [10, 100],
                [20, 110],
                [30, 135],
            ]);

            expect(
                service.getElapsedSecForTrackIndex(data, 30)
            ).toBe(35);
        });

        it('should return a negative value when the matching point is before the first time', () => {
            const data = createData([
                [10, 200],
                [20, 150],
            ]);

            expect(
                service.getElapsedSecForTrackIndex(data, 20)
            ).toBe(-50);
        });

        it('should use the first matching index when duplicate track indices exist', () => {
            const data = createData([
                [10, 100],
                [20, 110],
                [20, 130],
            ]);

            expect(
                service.getElapsedSecForTrackIndex(data, 20)
            ).toBe(10);
        });
    });

    describe('findNearestDataIndexByElapsedTime', () => {
        it('should return null for empty data', () => {
            expect(
                service.findNearestDataIndexByElapsedTime([], 10)
            ).toBeNull();
        });

        it('should find an exact elapsed time match', () => {
            const data = createData([
                [10, 100],
                [20, 110],
                [30, 125],
            ]);

            expect(
                service.findNearestDataIndexByElapsedTime(data, 10)
            ).toBe(1);

            expect(
                service.findNearestDataIndexByElapsedTime(data, 25)
            ).toBe(2);
        });

        it('should find the nearest point before the requested time', () => {
            const data = createData([
                [10, 100],
                [20, 110],
                [30, 130],
            ]);

            expect(
                service.findNearestDataIndexByElapsedTime(data, 16)
            ).toBe(1);
        });

        it('should find the nearest point after the requested time', () => {
            const data = createData([
                [10, 100],
                [20, 110],
                [30, 130],
            ]);

            expect(
                service.findNearestDataIndexByElapsedTime(data, 25)
            ).toBe(2);
        });
        
        it('should choose the earlier point when distances are equal', () => {
            const data = createData([
                [10, 100],
                [20, 110],
                [30, 120],
            ]);

            /*
             * 15 Sekunden liegt genau zwischen Index 1 und Index 2.
             * Wegen distance < bestDistance gewinnt der frühere Punkt.
             */
            expect(
                service.findNearestDataIndexByElapsedTime(data, 15)
            ).toBe(1);
        });

        it('should return the first point for elapsed times below zero', () => {
            const data = createData([
                [10, 100],
                [20, 110],
                [30, 120],
            ]);

            expect(
                service.findNearestDataIndexByElapsedTime(data, -100)
            ).toBe(0);
        });

        it('should return the last point for elapsed times above the range', () => {
            const data = createData([
                [10, 100],
                [20, 110],
                [30, 120],
            ]);

            expect(
                service.findNearestDataIndexByElapsedTime(data, 1_000)
            ).toBe(2);
        });

        it('should work with irregular time intervals', () => {
            const data = createData([
                [10, 1_000],
                [20, 1_001],
                [30, 1_100],
            ]);

            expect(
                service.findNearestDataIndexByElapsedTime(data, 40)
            ).toBe(1);

            expect(
                service.findNearestDataIndexByElapsedTime(data, 80)
            ).toBe(2);
        });
    });

    describe('formatTime', () => {
        it('should format zero', () => {
            expect(service.formatTime(0)).toBe('00:00:00');
        });

        it('should format hours, minutes and seconds', () => {
            expect(service.formatTime(3_661)).toBe('01:01:01');
            expect(service.formatTime(36_000)).toBe('10:00:00');
        });

        it('should floor decimal seconds', () => {
            expect(service.formatTime(65.99)).toBe('00:01:05');
        });

        it('should clamp negative values to zero', () => {
            expect(service.formatTime(-1)).toBe('00:00:00');
            expect(service.formatTime(-100.5)).toBe('00:00:00');
        });

        it('should support durations longer than 24 hours', () => {
            expect(service.formatTime(90_061)).toBe('25:01:01');
        });
    });
});

function createData(
    values: Array<[index: number, timeSec: number]>
): FlightChartPoint[] {
    return values.map(([index, timeSec]) => ({
        index,
        timeSec,
        value: index,
    }));
}