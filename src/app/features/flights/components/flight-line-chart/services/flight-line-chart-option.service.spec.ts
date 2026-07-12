import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartOptionService } from './flight-line-chart-option.service';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';
import { FlightLineChartTooltipService } from './flight-line-chart-tooltip.service';

describe('FlightLineChartOptionService', () => {
    let service: FlightLineChartOptionService;
    let tooltipService: FlightLineChartTooltipService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                FlightLineChartOptionService,
                FlightLineChartTimeService,
                FlightLineChartTooltipService,
            ],
        });

        service = TestBed.inject(FlightLineChartOptionService);
        tooltipService = TestBed.inject(FlightLineChartTooltipService);
    });

    it('should build the basic chart configuration', () => {
        const option = buildOption();

        expect(option).toMatchObject({
            animation: false,
            grid: {
                left: 48,
                right: 18,
                top: 18,
                bottom: 28,
            },
            xAxis: {
                type: 'value',
                min: 0,
                max: 30,
                boundaryGap: false,
            },
            yAxis: {
                type: 'value',
                scale: true,
                axisLabel: {
                    formatter: '{value} m',
                },
            },
            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: 0,
                    start: 10,
                    end: 80,
                },
            ],
        });
    });

    it('should transform chart points into ECharts series data', () => {
        const option = buildOption();

        const series = getMainSeries(option);

        expect(series.data).toEqual([
            [0, 500, 10, 100],
            [10, 520, 20, 110],
            [30, 540, 30, 130],
        ]);
    });

    it('should configure the main line series', () => {
        const option = buildOption();

        const series = getMainSeries(option);

        expect(series).toMatchObject({
            id: 'main',
            name: 'Altitude',
            type: 'line',
            showSymbol: false,
            lineStyle: {
                width: 1.5,
            },
            emphasis: {
                disabled: true,
            },
        });
    });

    it('should include mark-line data', () => {
        const markLineData = [
            {
                xAxis: 10,
            },
            {
                xAxis: 20,
            },
        ];

        const option = service.buildChartOption({
            title: 'Altitude',
            unit: 'm',
            chartType: 'altitude',
            data: createData(),
            markLineData,
            zoomStartPercent: 0,
            zoomEndPercent: 100,
        });

        const series = getMainSeries(option);

        expect(series.markLine).toEqual({
            silent: true,
            symbol: 'none',
            label: {
                show: false,
            },
            data: markLineData,
        });
    });

    it('should create a zero-length x axis for empty data', () => {
        const option = service.buildChartOption({
            title: 'Altitude',
            unit: 'm',
            chartType: 'altitude',
            data: [],
            markLineData: [],
            zoomStartPercent: 0,
            zoomEndPercent: 100,
        });

        const xAxis = getXAxis(option);

        expect(xAxis.min).toBe(0);
        expect(xAxis.max).toBe(0);

        expect(getMainSeries(option).data).toEqual([]);
    });

    it('should clamp a backwards time range to zero', () => {
        const option = service.buildChartOption({
            title: 'Altitude',
            unit: 'm',
            chartType: 'altitude',
            data: [
                {
                    index: 10,
                    timeSec: 200,
                    value: 500,
                },
                {
                    index: 20,
                    timeSec: 100,
                    value: 600,
                },
            ],
            markLineData: [],
            zoomStartPercent: 0,
            zoomEndPercent: 100,
        });

        expect(getXAxis(option).max).toBe(0);

        expect(getMainSeries(option).data).toEqual([
            [0, 500, 10, 200],
            [-100, 600, 20, 100],
        ]);
    });

    it('should format x-axis values as relative time', () => {
        const option = buildOption();
        const xAxis = getXAxis(option);

        const formatter = getFormatter(
            (xAxis.axisLabel as { formatter?: unknown }).formatter
        );

        expect(formatter(0)).toBe('00:00:00');
        expect(formatter(65)).toBe('00:01:05');
        expect(formatter(3_661)).toBe('01:01:01');
    });

    it('should delegate tooltip formatting with the chart type', () => {
        const tooltipSpy = vi
            .spyOn(tooltipService, 'formatTooltip')
            .mockReturnValue('<div>Tooltip</div>');

        const option = service.buildChartOption({
            title: 'Vario',
            unit: 'm/s',
            chartType: 'vario',
            data: createData(),
            markLineData: [],
            zoomStartPercent: 0,
            zoomEndPercent: 100,
        });

        const tooltip = option['tooltip'] as {
            formatter?: unknown;
        };

        const formatter = getUnknownFormatter(tooltip.formatter);
        const params = {
            data: [10, 1.5, 20, 110],
        };

        expect(formatter(params)).toBe('<div>Tooltip</div>');

        expect(tooltipSpy).toHaveBeenCalledWith(
            params,
            'vario'
        );
    });

    it('should configure transparent tooltip styling', () => {
        const option = buildOption();

        expect(option['tooltip']).toMatchObject({
            trigger: 'axis',
            confine: true,
            backgroundColor: 'transparent',
            borderWidth: 0,
            padding: 0,
            extraCssText: 'box-shadow: none;',
        });
    });

    describe('buildMarkLineUpdateOption', () => {
        it('should build a partial series update', () => {
            const markLineData = [
                {
                    xAxis: 25,
                },
            ];

            const option =
                service.buildMarkLineUpdateOption(markLineData);

            expect(option).toEqual({
                series: [
                    {
                        id: 'main',
                        markLine: {
                            silent: true,
                            symbol: 'none',
                            label: {
                                show: false,
                            },
                            data: markLineData,
                        },
                    },
                ],
            });
        });

        it('should support empty mark-line data', () => {
            const option =
                service.buildMarkLineUpdateOption([]);

            expect(option).toEqual({
                series: [
                    {
                        id: 'main',
                        markLine: {
                            silent: true,
                            symbol: 'none',
                            label: {
                                show: false,
                            },
                            data: [],
                        },
                    },
                ],
            });
        });
    });

    function buildOption() {
        return service.buildChartOption({
            title: 'Altitude',
            unit: 'm',
            chartType: 'altitude',
            data: createData(),
            markLineData: [],
            zoomStartPercent: 10,
            zoomEndPercent: 80,
        });
    }
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
            value: 520,
        },
        {
            index: 30,
            timeSec: 130,
            value: 540,
        },
    ];
}

function getMainSeries(
    option: Record<string, unknown>
): {
    data?: unknown;
    markLine?: unknown;
    [key: string]: unknown;
} {
    const series = option['series'];

    if (!Array.isArray(series) || !series[0]) {
        throw new Error('Main series is missing.');
    }

    return series[0] as {
        data?: unknown;
        markLine?: unknown;
        [key: string]: unknown;
    };
}

function getXAxis(
    option: Record<string, unknown>
): {
    min?: unknown;
    max?: unknown;
    axisLabel?: unknown;
} {
    const xAxis = option['xAxis'];

    if (!xAxis || typeof xAxis !== 'object') {
        throw new Error('X axis is missing.');
    }

    return xAxis as {
        min?: unknown;
        max?: unknown;
        axisLabel?: unknown;
    };
}

function getFormatter(
    value: unknown
): (input: number) => string {
    if (typeof value !== 'function') {
        throw new Error('Formatter is missing.');
    }

    return value as (input: number) => string;
}

function getUnknownFormatter(
    value: unknown
): (input: unknown) => string {
    if (typeof value !== 'function') {
        throw new Error('Formatter is missing.');
    }

    return value as (input: unknown) => string;
}