import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ECharts } from 'echarts/core';

import { Climb } from '../../../models/climb.model';
import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';
import { FlightLineChartZoomService } from './flight-line-chart-zoom.service';

describe('FlightLineChartZoomService', () => {
  let service: FlightLineChartZoomService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FlightLineChartZoomService,
        FlightLineChartTimeService,
      ],
    });

    service = TestBed.inject(FlightLineChartZoomService);
  });

  it('should initially represent the complete zoom range', () => {
    expect(service.getCurrentZoomStartPercent()).toBe(0);
    expect(service.getCurrentZoomEndPercent()).toBe(100);
  });

  describe('rememberDataZoomEvent', () => {
    it('should remember start and end percentages', () => {
      service.rememberDataZoomEvent({
        start: 20,
        end: 80,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(20);
      expect(service.getCurrentZoomEndPercent()).toBe(80);
    });

    it('should read the first batch entry', () => {
      service.rememberDataZoomEvent({
        batch: [
          {
            start: 25,
            end: 75,
          },
          {
            start: 40,
            end: 60,
          },
        ],
      });

      expect(service.getCurrentZoomStartPercent()).toBe(25);
      expect(service.getCurrentZoomEndPercent()).toBe(75);
    });

    it('should update only values contained in the event', () => {
      service.rememberDataZoomEvent({
        start: 20,
        end: 80,
      });

      service.rememberDataZoomEvent({
        start: 30,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(30);
      expect(service.getCurrentZoomEndPercent()).toBe(80);
    });

    it('should clamp percentages to zero and one hundred', () => {
      service.rememberDataZoomEvent({
        start: -50,
        end: 150,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(0);
      expect(service.getCurrentZoomEndPercent()).toBe(100);
    });

    it('should convert non-finite percentages to zero', () => {
      service.rememberDataZoomEvent({
        start: Number.NaN,
        end: Number.POSITIVE_INFINITY,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(0);
      expect(service.getCurrentZoomEndPercent()).toBe(0);
    });

    it('should ignore null and primitive events', () => {
      service.rememberDataZoomEvent({
        start: 20,
        end: 80,
      });

      service.rememberDataZoomEvent(null);
      service.rememberDataZoomEvent(undefined);
      service.rememberDataZoomEvent('invalid');

      expect(service.getCurrentZoomStartPercent()).toBe(20);
      expect(service.getCurrentZoomEndPercent()).toBe(80);
    });

    it('should ignore startValue and endValue for remembered percentages', () => {
      service.rememberDataZoomEvent({
        start: 20,
        end: 80,
      });

      service.rememberDataZoomEvent({
        startValue: 100,
        endValue: 200,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(20);
      expect(service.getCurrentZoomEndPercent()).toBe(80);
    });
  });

  describe('attach and detach', () => {
    it('should register a dataZoom handler', () => {
      const chart = createChartMock();

      service.attach(chart);

      expect(chart.on).toHaveBeenCalledTimes(1);
      expect(chart.on).toHaveBeenCalledWith(
        'dataZoom',
        expect.any(Function)
      );
    });

    it('should remember zoom events received from the chart', () => {
      const chart = createChartMock();

      service.attach(chart);

      const handler = vi.mocked(chart.on).mock.calls[0][1] as (
        event: unknown
      ) => void;

      handler({
        start: 15,
        end: 65,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(15);
      expect(service.getCurrentZoomEndPercent()).toBe(65);
    });

    it('should unregister the current handler on detach', () => {
      const chart = createChartMock();

      service.attach(chart);

      const handler = vi.mocked(chart.on).mock.calls[0][1];

      service.detach();

      expect(chart.off).toHaveBeenCalledWith(
        'dataZoom',
        handler
      );
    });

    it('should detach the previous chart when attaching another chart', () => {
      const firstChart = createChartMock();
      const secondChart = createChartMock();

      service.attach(firstChart);

      const firstHandler =
        vi.mocked(firstChart.on).mock.calls[0][1];

      service.attach(secondChart);

      expect(firstChart.off).toHaveBeenCalledWith(
        'dataZoom',
        firstHandler
      );

      expect(secondChart.on).toHaveBeenCalledWith(
        'dataZoom',
        expect.any(Function)
      );
    });

    it('should allow detach before a chart was attached', () => {
      expect(() => service.detach()).not.toThrow();
    });
  });

  describe('zoomToFullFlight', () => {
    it('should dispatch a full-range zoom action', () => {
      const chart = createChartMock();

      service.rememberDataZoomEvent({
        start: 20,
        end: 80,
      });

      service.zoomToFullFlight(chart);

      expect(chart.dispatchAction).toHaveBeenCalledWith({
        type: 'dataZoom',
        xAxisIndex: 0,
        start: 0,
        end: 100,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(0);
      expect(service.getCurrentZoomEndPercent()).toBe(100);
    });
  });

  describe('zoomToRange', () => {
    it('should dispatch a zoom action using value coordinates', () => {
      const chart = createChartMock();
      const data = createData();

      service.zoomToRange(chart, data, 20, 80);

      expect(chart.dispatchAction).toHaveBeenCalledWith({
        type: 'dataZoom',
        xAxisIndex: 0,
        startValue: 20,
        endValue: 80,
      });
    });

    it('should normalize a reversed range', () => {
      const chart = createChartMock();
      const data = createData();

      service.zoomToRange(chart, data, 80, 20);

      expect(chart.dispatchAction).toHaveBeenCalledWith({
        type: 'dataZoom',
        xAxisIndex: 0,
        startValue: 20,
        endValue: 80,
      });
    });

    it('should convert the zoom values to percentages', () => {
      const chart = createChartMock();
      const data = createData();

      /*
       * Volle Dauer: 120 Sekunden.
       */
      service.zoomToRange(chart, data, 30, 90);

      expect(service.getCurrentZoomStartPercent()).toBe(25);
      expect(service.getCurrentZoomEndPercent()).toBe(75);
    });

    it('should clamp calculated percentages', () => {
      const chart = createChartMock();
      const data = createData();

      service.zoomToRange(chart, data, -50, 200);

      expect(service.getCurrentZoomStartPercent()).toBe(0);
      expect(service.getCurrentZoomEndPercent()).toBe(100);
    });

    it('should keep full percentages when the data has no duration', () => {
      const chart = createChartMock();

      const data: FlightChartPoint[] = [
        {
          index: 10,
          timeSec: 100,
          value: 500,
        },
      ];

      service.zoomToRange(chart, data, 10, 20);

      expect(chart.dispatchAction).toHaveBeenCalledWith({
        type: 'dataZoom',
        xAxisIndex: 0,
        startValue: 10,
        endValue: 20,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(0);
      expect(service.getCurrentZoomEndPercent()).toBe(100);
    });
  });

  describe('zoomToSelectedClimb', () => {
    it('should zoom to the selected climb with minimum padding', () => {
      const chart = createChartMock();
      const data = createData();

      const climbs = [
        createClimb(7, 20, 30),
      ];

      /*
       * Trackindex 20 = 30 Sekunden
       * Trackindex 30 = 60 Sekunden
       * Climb-Dauer = 30 Sekunden
       * Padding = max(30, 7.5) = 30 Sekunden
       * Ergebnis = 0 bis 90 Sekunden
       */
      service.zoomToSelectedClimb(
        chart,
        data,
        climbs,
        7
      );

      expect(chart.dispatchAction).toHaveBeenCalledWith({
        type: 'dataZoom',
        xAxisIndex: 0,
        startValue: 0,
        endValue: 90,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(0);
      expect(service.getCurrentZoomEndPercent()).toBe(75);
    });

    it('should use twenty-five percent padding for a long climb', () => {
      const chart = createChartMock();

      const data: FlightChartPoint[] = [
        { index: 10, timeSec: 100, value: 500 },
        { index: 20, timeSec: 200, value: 600 },
        { index: 30, timeSec: 400, value: 700 },
        { index: 40, timeSec: 500, value: 800 },
      ];

      const climbs = [
        createClimb(7, 20, 30),
      ];

      /*
       * Relative Zeiten: 100 bis 300 Sekunden.
       * Dauer = 200 Sekunden.
       * Padding = 50 Sekunden.
       * Ergebnis = 50 bis 350 Sekunden.
       */
      service.zoomToSelectedClimb(
        chart,
        data,
        climbs,
        7
      );

      expect(chart.dispatchAction).toHaveBeenCalledWith({
        type: 'dataZoom',
        xAxisIndex: 0,
        startValue: 50,
        endValue: 350,
      });
    });

    it('should clamp climb padding to the complete flight range', () => {
      const chart = createChartMock();
      const data = createData();

      const climbs = [
        createClimb(7, 10, 40),
      ];

      service.zoomToSelectedClimb(
        chart,
        data,
        climbs,
        7
      );

      expect(chart.dispatchAction).toHaveBeenCalledWith({
        type: 'dataZoom',
        xAxisIndex: 0,
        startValue: 0,
        endValue: 120,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(0);
      expect(service.getCurrentZoomEndPercent()).toBe(100);
    });

    it('should do nothing when the selected climb does not exist', () => {
      const chart = createChartMock();

      service.zoomToSelectedClimb(
        chart,
        createData(),
        [],
        999
      );

      expect(chart.dispatchAction).not.toHaveBeenCalled();
    });

    it('should do nothing when the climb start index is not in the data', () => {
      const chart = createChartMock();

      service.zoomToSelectedClimb(
        chart,
        createData(),
        [createClimb(7, 999, 30)],
        7
      );

      expect(chart.dispatchAction).not.toHaveBeenCalled();
    });

    it('should do nothing when the climb end index is not in the data', () => {
      const chart = createChartMock();

      service.zoomToSelectedClimb(
        chart,
        createData(),
        [createClimb(7, 20, 999)],
        7
      );

      expect(chart.dispatchAction).not.toHaveBeenCalled();
    });

    it('should zoom to zero range when chart data has no duration', () => {
      const chart = createChartMock();

      const data: FlightChartPoint[] = [
        {
          index: 10,
          timeSec: 100,
          value: 500,
        },
      ];

      service.zoomToSelectedClimb(
        chart,
        data,
        [createClimb(7, 10, 10)],
        7
      );

      expect(chart.dispatchAction).toHaveBeenCalledWith({
        type: 'dataZoom',
        xAxisIndex: 0,
        startValue: 0,
        endValue: 0,
      });

      expect(service.getCurrentZoomStartPercent()).toBe(0);
      expect(service.getCurrentZoomEndPercent()).toBe(100);
    });
  });
});

function createChartMock(): ECharts {
  return {
    on: vi.fn(),
    off: vi.fn(),
    dispatchAction: vi.fn(),
  } as unknown as ECharts;
}

function createData(): FlightChartPoint[] {
  return [
    {
      index: 10,
      timeSec: 100,
      value: 500,
    },
    {
      index: 20,
      timeSec: 130,
      value: 550,
    },
    {
      index: 30,
      timeSec: 160,
      value: 600,
    },
    {
      index: 40,
      timeSec: 220,
      value: 650,
    },
  ];
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