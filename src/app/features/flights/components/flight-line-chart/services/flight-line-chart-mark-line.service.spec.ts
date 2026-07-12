import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Climb } from '../../../models/climb.model';
import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartMarkLineService } from './flight-line-chart-mark-line.service';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';

describe('FlightLineChartMarkLineService', () => {
  let service: FlightLineChartMarkLineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FlightLineChartMarkLineService,
        FlightLineChartTimeService,
      ],
    });

    service = TestBed.inject(FlightLineChartMarkLineService);
  });

  it('should return an empty array when no climbs and no cursor exist', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [],
      selectedClimbId: null,
      showAllClimbs: true,
      cursorTrackIndex: null,
    });

    expect(result).toEqual([]);
  });

  it('should hide all climb boundaries when showAllClimbs is false', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [createClimb(1, 10, 30)],
      selectedClimbId: 1,
      showAllClimbs: false,
      cursorTrackIndex: null,
    });

    expect(result).toEqual([]);
  });

  it('should create start and end boundary lines for a climb', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [createClimb(1, 10, 30)],
      selectedClimbId: null,
      showAllClimbs: true,
      cursorTrackIndex: null,
    });

    expect(result).toEqual([
      {
        xAxis: 0,
        lineStyle: {
          color: '#2563eb',
          type: 'dotted',
          width: 1.5,
          opacity: 0.65,
        },
        label: {
          show: false,
        },
      },
      {
        xAxis: 20,
        lineStyle: {
          color: '#2563eb',
          type: 'dotted',
          width: 1.5,
          opacity: 0.65,
        },
        label: {
          show: false,
        },
      },
    ]);
  });

  it('should highlight the selected climb', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [createClimb(7, 20, 40)],
      selectedClimbId: 7,
      showAllClimbs: true,
      cursorTrackIndex: null,
    });

    expect(result).toEqual([
      {
        xAxis: 10,
        lineStyle: {
          color: '#2563eb',
          type: 'dotted',
          width: 2.5,
          opacity: 1,
        },
        label: {
          show: false,
        },
      },
      {
        xAxis: 30,
        lineStyle: {
          color: '#2563eb',
          type: 'dotted',
          width: 2.5,
          opacity: 1,
        },
        label: {
          show: false,
        },
      },
    ]);
  });

  it('should assign different colors based on climb order', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [
        createClimb(1, 10, 20),
        createClimb(2, 30, 40),
        createClimb(3, 40, 50),
      ],
      selectedClimbId: null,
      showAllClimbs: true,
      cursorTrackIndex: null,
    }) as Array<{
      lineStyle: {
        color: string;
      };
    }>;

    expect(result.map((line) => line.lineStyle.color)).toEqual([
      '#2563eb',
      '#2563eb',
      '#16a34a',
      '#16a34a',
      '#dc2626',
      '#dc2626',
    ]);
  });

  it('should cycle colors after eight climbs', () => {
    const climbs = Array.from(
      { length: 9 },
      (_, index) => createClimb(index + 1, 10, 20)
    );

    const result = service.buildMarkLineData({
      data: createData(),
      climbs,
      selectedClimbId: null,
      showAllClimbs: true,
      cursorTrackIndex: null,
    }) as Array<{
      lineStyle: {
        color: string;
      };
    }>;

    expect(result[0].lineStyle.color).toBe('#2563eb');
    expect(result[16].lineStyle.color).toBe('#2563eb');
  });

  it('should skip a climb when its start index is not present in chart data', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [createClimb(1, 999, 30)],
      selectedClimbId: null,
      showAllClimbs: true,
      cursorTrackIndex: null,
    });

    expect(result).toEqual([]);
  });

  it('should skip a climb when its end index is not present in chart data', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [createClimb(1, 10, 999)],
      selectedClimbId: null,
      showAllClimbs: true,
      cursorTrackIndex: null,
    });

    expect(result).toEqual([]);
  });

  it('should create a cursor line', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [],
      selectedClimbId: null,
      showAllClimbs: false,
      cursorTrackIndex: 30,
    });

    expect(result).toEqual([
      {
        xAxis: 20,
        lineStyle: {
          type: 'solid',
          width: 1,
          color: '#101828',
          opacity: 0.9,
        },
        label: {
          show: false,
        },
      },
    ]);
  });

  it('should skip the cursor when its track index is not present', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [],
      selectedClimbId: null,
      showAllClimbs: true,
      cursorTrackIndex: 999,
    });

    expect(result).toEqual([]);
  });

  it('should append the cursor after all climb boundaries', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [createClimb(1, 10, 30)],
      selectedClimbId: null,
      showAllClimbs: true,
      cursorTrackIndex: 40,
    }) as Array<{
      xAxis: number;
      lineStyle: {
        type: string;
      };
    }>;

    expect(result).toHaveLength(3);

    expect(result.map((line) => line.xAxis)).toEqual([
      0,
      20,
      30,
    ]);

    expect(result[0].lineStyle.type).toBe('dotted');
    expect(result[1].lineStyle.type).toBe('dotted');
    expect(result[2].lineStyle.type).toBe('solid');
  });

  it('should render only the cursor when climbs are hidden', () => {
    const result = service.buildMarkLineData({
      data: createData(),
      climbs: [createClimb(1, 10, 30)],
      selectedClimbId: 1,
      showAllClimbs: false,
      cursorTrackIndex: 20,
    }) as Array<{
      xAxis: number;
      lineStyle: {
        type: string;
      };
    }>;

    expect(result).toHaveLength(1);
    expect(result[0].xAxis).toBe(10);
    expect(result[0].lineStyle.type).toBe('solid');
  });
});

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
      timeSec: 120,
      value: 520,
    },
    {
      index: 40,
      timeSec: 130,
      value: 530,
    },
    {
      index: 50,
      timeSec: 140,
      value: 540,
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