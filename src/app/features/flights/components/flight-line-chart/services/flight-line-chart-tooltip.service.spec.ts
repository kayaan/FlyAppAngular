import { beforeEach, describe, expect, it } from 'vitest';

import { FlightLineChartTooltipService } from './flight-line-chart-tooltip.service';

describe('FlightLineChartTooltipService', () => {
  let service: FlightLineChartTooltipService;

  beforeEach(() => {
    service = new FlightLineChartTooltipService();
  });

  it('should return an empty string when params are missing', () => {
    expect(
      service.formatTooltip(null, 'altitude')
    ).toBe('');

    expect(
      service.formatTooltip(undefined, 'altitude')
    ).toBe('');
  });

  it('should return an empty string when the tooltip item has no data', () => {
    expect(
      service.formatTooltip({}, 'altitude')
    ).toBe('');

    expect(
      service.formatTooltip([{}], 'altitude')
    ).toBe('');
  });

  it('should return an empty string for invalid elapsed time', () => {
    const result = service.formatTooltip(
      createTooltipItem(Number.NaN, 500, 100),
      'altitude'
    );

    expect(result).toBe('');
  });

  it('should return an empty string for an invalid value', () => {
    const result = service.formatTooltip(
      createTooltipItem(10, Number.NaN, 100),
      'altitude'
    );

    expect(result).toBe('');
  });

  it('should return an empty string for invalid absolute time', () => {
    const result = service.formatTooltip(
      createTooltipItem(10, 500, Number.POSITIVE_INFINITY),
      'altitude'
    );

    expect(result).toBe('');
  });

  describe('altitude tooltip', () => {
    it('should format altitude as rounded meters', () => {
      const result = service.formatTooltip(
        createTooltipItem(
          65,
          1_234.56,
          10 * 3600 + 15 * 60 + 30
        ),
        'altitude'
      );

      expect(normalizeHtml(result)).toContain(
        '<div class="chart-tooltip-value altitude"> 1235 m </div>'
      );

      expect(normalizeHtml(result)).toContain(
        '<div class="chart-tooltip-time"> 00:01:05 · 10:15:30 </div>'
      );
    });

    it('should round negative altitude values', () => {
      const result = service.formatTooltip(
        createTooltipItem(0, -10.6, 0),
        'altitude'
      );

      expect(normalizeHtml(result)).toContain(
        '<div class="chart-tooltip-value altitude"> -11 m </div>'
      );
    });
  });

  describe('vario tooltip', () => {
    it('should format positive vario with plus sign and one decimal place', () => {
      const result = service.formatTooltip(
        createTooltipItem(10, 1.44, 12_000),
        'vario'
      );

      expect(normalizeHtml(result)).toContain(
        '<div class="chart-tooltip-value vario-positive"> +1.4 m/s </div>'
      );
    });

    it('should format negative vario without an additional sign', () => {
      const result = service.formatTooltip(
        createTooltipItem(10, -2.36, 12_000),
        'vario'
      );

      expect(normalizeHtml(result)).toContain(
        '<div class="chart-tooltip-value vario-negative"> -2.4 m/s </div>'
      );
    });

    it('should treat zero vario as positive class', () => {
      const result = service.formatTooltip(
        createTooltipItem(10, 0, 12_000),
        'vario'
      );

      expect(normalizeHtml(result)).toContain(
        '<div class="chart-tooltip-value vario-positive"> 0.0 m/s </div>'
      );
    });

    it('should preserve exactly one decimal place', () => {
      const result = service.formatTooltip(
        createTooltipItem(10, 2, 12_000),
        'vario'
      );

      expect(result).toContain('+2.0 m/s');
    });
  });

  describe('speed tooltip', () => {
    it('should format speed as rounded kilometers per hour', () => {
      const result = service.formatTooltip(
        createTooltipItem(10, 42.6, 12_000),
        'speed'
      );

      expect(normalizeHtml(result)).toContain(
        '<div class="chart-tooltip-value speed"> 43 km/h </div>'
      );
    });

    it('should format zero speed', () => {
      const result = service.formatTooltip(
        createTooltipItem(0, 0, 0),
        'speed'
      );

      expect(normalizeHtml(result)).toContain(
        '<div class="chart-tooltip-value speed"> 0 km/h </div>'
      );
    });
  });

  describe('time formatting', () => {
    it('should floor decimal elapsed and absolute seconds', () => {
      const result = service.formatTooltip(
        createTooltipItem(
          65.99,
          500,
          3_661.99
        ),
        'altitude'
      );

      expect(result).toContain(
        '00:01:05 · 01:01:01'
      );
    });

    it('should clamp negative elapsed time to zero', () => {
      const result = service.formatTooltip(
        createTooltipItem(-100, 500, 3_600),
        'altitude'
      );

      expect(result).toContain(
        '00:00:00 · 01:00:00'
      );
    });

    it('should clamp negative absolute time to zero', () => {
      const result = service.formatTooltip(
        createTooltipItem(10, 500, -100),
        'altitude'
      );

      expect(result).toContain(
        '00:00:10 · 00:00:00'
      );
    });

    it('should wrap clock time after 24 hours', () => {
      const result = service.formatTooltip(
        createTooltipItem(
          90_061,
          500,
          90_061
        ),
        'altitude'
      );

      /*
       * Flight duration may exceed 24 hours.
       * Clock time wraps using modulo 86400.
       */
      expect(result).toContain(
        '25:01:01 · 01:01:01'
      );
    });
  });

  it('should use the first item when ECharts passes an array', () => {
    const result = service.formatTooltip(
      [
        createTooltipItem(10, 500, 3_600),
        createTooltipItem(20, 900, 7_200),
      ],
      'altitude'
    );

    expect(result).toContain('500 m');
    expect(result).toContain(
      '00:00:10 · 01:00:00'
    );

    expect(result).not.toContain('900 m');
    expect(result).not.toContain(
      '00:00:20 · 02:00:00'
    );
  });

  it('should ignore the track index when formatting the tooltip', () => {
    const firstResult = service.formatTooltip(
      createTooltipItem(10, 500, 3_600, 1),
      'altitude'
    );

    const secondResult = service.formatTooltip(
      createTooltipItem(10, 500, 3_600, 999),
      'altitude'
    );

    expect(secondResult).toBe(firstResult);
  });
});

function createTooltipItem(
  elapsedSec: number,
  value: number,
  absoluteTimeSec: number,
  trackIndex = 42
): {
  data: [number, number, number, number];
} {
  return {
    data: [
      elapsedSec,
      value,
      trackIndex,
      absoluteTimeSec,
    ],
  };
}

function normalizeHtml(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}