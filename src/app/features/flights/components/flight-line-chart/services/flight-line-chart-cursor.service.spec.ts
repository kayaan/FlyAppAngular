import { TestBed } from '@angular/core/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ECharts } from 'echarts/core';

import { FlightDetailsStore } from '../../../store/flight-details.store';
import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartCursorService } from './flight-line-chart-cursor.service';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';

describe('FlightLineChartCursorService', () => {
  let service: FlightLineChartCursorService;
  let storeMock: {
    replay: ReturnType<typeof vi.fn>;
    cursorIndex: ReturnType<typeof vi.fn>;
    setCursorIndex: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    storeMock = {
      replay: vi.fn().mockReturnValue({
        active: false,
        index: null,
      }),
      cursorIndex: vi.fn().mockReturnValue(null),
      setCursorIndex: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        FlightLineChartCursorService,
        FlightLineChartTimeService,
        {
          provide: FlightDetailsStore,
          useValue: storeMock,
        },
      ],
    });

    service = TestBed.inject(FlightLineChartCursorService);
  });

  afterEach(() => {
    service.detachHoverEvents();
    vi.restoreAllMocks();
  });

  describe('attachHoverEvents', () => {
    it('should register chart and mouseleave handlers', () => {
      const chart = createChartMock();
      const container = document.createElement('div');

      const addEventListenerSpy = vi.spyOn(
        container,
        'addEventListener'
      );

      service.attachHoverEvents(
        chart,
        container,
        () => createData()
      );

      expect(chart.on).toHaveBeenCalledWith(
        'updateAxisPointer',
        expect.any(Function)
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mouseleave',
        expect.any(Function)
      );
    });

    it('should set the nearest track index on axis-pointer movement', () => {
      const chart = createChartMock();
      const container = document.createElement('div');

      service.attachHoverEvents(
        chart,
        container,
        () => createData()
      );

      const handler = getChartHandler(chart);

      /*
       * Relative chart times:
       * index 10 -> 0 seconds
       * index 20 -> 10 seconds
       * index 30 -> 30 seconds
       *
       * 26 seconds is nearest to track index 30.
       */
      handler({
        axesInfo: [
          {
            value: 26,
          },
        ],
      });

      expect(storeMock.setCursorIndex).toHaveBeenCalledWith(30);
    });

    it('should accept numeric strings from the axis-pointer event', () => {
      const chart = createChartMock();
      const container = document.createElement('div');

      service.attachHoverEvents(
        chart,
        container,
        () => createData()
      );

      const handler = getChartHandler(chart);

      handler({
        axesInfo: [
          {
            value: '10',
          },
        ],
      });

      expect(storeMock.setCursorIndex).toHaveBeenCalledWith(20);
    });

    it('should not update the store when the cursor index is unchanged', () => {
      storeMock.cursorIndex.mockReturnValue(20);

      const chart = createChartMock();
      const container = document.createElement('div');

      service.attachHoverEvents(
        chart,
        container,
        () => createData()
      );

      const handler = getChartHandler(chart);

      handler({
        axesInfo: [
          {
            value: 10,
          },
        ],
      });

      expect(storeMock.setCursorIndex).not.toHaveBeenCalled();
    });

    it('should ignore axis-pointer events during replay', () => {
      storeMock.replay.mockReturnValue({
        active: true,
        index: 20,
      });

      const chart = createChartMock();
      const container = document.createElement('div');

      service.attachHoverEvents(
        chart,
        container,
        () => createData()
      );

      const handler = getChartHandler(chart);

      handler({
        axesInfo: [
          {
            value: 10,
          },
        ],
      });

      expect(storeMock.setCursorIndex).not.toHaveBeenCalled();
    });

    it.each([
      null,
      undefined,
      {},
      { axesInfo: [] },
      { axesInfo: [{}] },
      { axesInfo: [{ value: 'invalid' }] },
      { axesInfo: [{ value: Number.NaN }] },
    ])(
      'should ignore invalid axis-pointer event %#',
      (event) => {
        const chart = createChartMock();
        const container = document.createElement('div');

        service.attachHoverEvents(
          chart,
          container,
          () => createData()
        );

        const handler = getChartHandler(chart);

        handler(event);

        expect(storeMock.setCursorIndex).not.toHaveBeenCalled();
      }
    );

    it('should do nothing when chart data is empty', () => {
      const chart = createChartMock();
      const container = document.createElement('div');

      service.attachHoverEvents(
        chart,
        container,
        () => []
      );

      const handler = getChartHandler(chart);

      handler({
        axesInfo: [
          {
            value: 10,
          },
        ],
      });

      expect(storeMock.setCursorIndex).not.toHaveBeenCalled();
    });

    it('should clear the cursor when the mouse leaves', () => {
      const chart = createChartMock();
      const container = document.createElement('div');

      service.attachHoverEvents(
        chart,
        container,
        () => createData()
      );

      container.dispatchEvent(
        new MouseEvent('mouseleave')
      );

      expect(storeMock.setCursorIndex).toHaveBeenCalledWith(null);
    });

    it('should not clear the cursor on mouseleave during replay', () => {
      storeMock.replay.mockReturnValue({
        active: true,
        index: 20,
      });

      const chart = createChartMock();
      const container = document.createElement('div');

      service.attachHoverEvents(
        chart,
        container,
        () => createData()
      );

      container.dispatchEvent(
        new MouseEvent('mouseleave')
      );

      expect(storeMock.setCursorIndex).not.toHaveBeenCalled();
    });

    it('should detach previous handlers before attaching again', () => {
      const firstChart = createChartMock();
      const secondChart = createChartMock();

      const firstContainer = document.createElement('div');
      const secondContainer = document.createElement('div');

      const removeEventListenerSpy = vi.spyOn(
        firstContainer,
        'removeEventListener'
      );

      service.attachHoverEvents(
        firstChart,
        firstContainer,
        () => createData()
      );

      const firstHandler = getChartHandler(firstChart);

      service.attachHoverEvents(
        secondChart,
        secondContainer,
        () => createData()
      );

      expect(firstChart.off).toHaveBeenCalledWith(
        'updateAxisPointer',
        firstHandler
      );

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mouseleave',
        expect.any(Function)
      );

      expect(secondChart.on).toHaveBeenCalledWith(
        'updateAxisPointer',
        expect.any(Function)
      );
    });
  });

  describe('detachHoverEvents', () => {
    it('should unregister chart and DOM handlers', () => {
      const chart = createChartMock();
      const container = document.createElement('div');

      const removeEventListenerSpy = vi.spyOn(
        container,
        'removeEventListener'
      );

      service.attachHoverEvents(
        chart,
        container,
        () => createData()
      );

      const chartHandler = getChartHandler(chart);

      service.detachHoverEvents();

      expect(chart.off).toHaveBeenCalledWith(
        'updateAxisPointer',
        chartHandler
      );

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mouseleave',
        expect.any(Function)
      );
    });

    it('should allow detach before attach', () => {
      expect(() => service.detachHoverEvents()).not.toThrow();
    });
  });

  describe('getDisplayedTrackIndex', () => {
    it('should return the replay index during active replay', () => {
      storeMock.replay.mockReturnValue({
        active: true,
        index: 30,
      });

      storeMock.cursorIndex.mockReturnValue(20);

      expect(service.getDisplayedTrackIndex()).toBe(30);
    });

    it('should return cursor index when replay is inactive', () => {
      storeMock.replay.mockReturnValue({
        active: false,
        index: 30,
      });

      storeMock.cursorIndex.mockReturnValue(20);

      expect(service.getDisplayedTrackIndex()).toBe(20);
    });

    it('should return cursor index when active replay has no index', () => {
      storeMock.replay.mockReturnValue({
        active: true,
        index: null,
      });

      storeMock.cursorIndex.mockReturnValue(20);

      expect(service.getDisplayedTrackIndex()).toBe(20);
    });

    it('should return null when neither cursor nor replay index exists', () => {
      storeMock.replay.mockReturnValue({
        active: false,
        index: null,
      });

      storeMock.cursorIndex.mockReturnValue(null);

      expect(service.getDisplayedTrackIndex()).toBeNull();
    });
  });

  describe('showCursorAtIndex', () => {
    it('should update mark line and show tooltip', () => {
      const chart = createChartMock();
      const buildMarkLineData = vi
        .fn()
        .mockReturnValue([
          {
            xAxis: 10,
          },
        ]);

      service.showCursorAtIndex(
        chart,
        createData(),
        20,
        buildMarkLineData
      );

      expect(buildMarkLineData).toHaveBeenCalledWith(20);

      expect(chart.setOption).toHaveBeenCalledWith({
        series: [
          {
            id: 'main',
            markLine: {
              silent: true,
              symbol: 'none',
              label: {
                show: false,
              },
              data: [
                {
                  xAxis: 10,
                },
              ],
            },
          },
        ],
      });

      expect(chart.dispatchAction).toHaveBeenCalledWith({
        type: 'showTip',
        seriesIndex: 0,
        dataIndex: 1,
      });
    });

    it('should do nothing when the track index is not in chart data', () => {
      const chart = createChartMock();
      const buildMarkLineData = vi.fn();

      service.showCursorAtIndex(
        chart,
        createData(),
        999,
        buildMarkLineData
      );

      expect(buildMarkLineData).not.toHaveBeenCalled();
      expect(chart.setOption).not.toHaveBeenCalled();
      expect(chart.dispatchAction).not.toHaveBeenCalled();
    });
  });

  describe('hideCursorLine', () => {
    it('should rebuild mark lines without a cursor', () => {
      const chart = createChartMock();
      const markLines = [
        {
          xAxis: 20,
        },
      ];

      const buildMarkLineData = vi
        .fn()
        .mockReturnValue(markLines);

      service.hideCursorLine(
        chart,
        buildMarkLineData
      );

      expect(buildMarkLineData).toHaveBeenCalledWith(null);

      expect(chart.setOption).toHaveBeenCalledWith({
        series: [
          {
            id: 'main',
            markLine: {
              silent: true,
              symbol: 'none',
              label: {
                show: false,
              },
              data: markLines,
            },
          },
        ],
      });
    });
  });

  describe('hideTooltip', () => {
    it('should hide tooltip and clear the axis pointer', () => {
      const chart = createChartMock();

      service.hideTooltip(chart);

      expect(chart.dispatchAction).toHaveBeenNthCalledWith(
        1,
        {
          type: 'hideTip',
        }
      );

      expect(chart.dispatchAction).toHaveBeenNthCalledWith(
        2,
        {
          type: 'updateAxisPointer',
          currTrigger: 'leave',
        }
      );
    });
  });
});

function createChartMock(): ECharts {
  return {
    on: vi.fn(),
    off: vi.fn(),
    setOption: vi.fn(),
    dispatchAction: vi.fn(),
  } as unknown as ECharts;
}

function getChartHandler(
  chart: ECharts
): (event: unknown) => void {
  const handler = vi.mocked(chart.on).mock.calls[0]?.[1];

  if (typeof handler !== 'function') {
    throw new Error(
      'updateAxisPointer handler was not registered.'
    );
  }

  return handler as (event: unknown) => void;
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
      timeSec: 110,
      value: 510,
    },
    {
      index: 30,
      timeSec: 130,
      value: 520,
    },
  ];
}