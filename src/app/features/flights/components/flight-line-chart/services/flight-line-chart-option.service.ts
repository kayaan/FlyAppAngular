import { Injectable, inject } from '@angular/core';

import type { EChartsCoreOption } from 'echarts/core';

import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';
import { FlightLineChartTooltipService } from './flight-line-chart-tooltip.service';

export interface FlightLineChartOptionOptions {
  title: string;
  unit: string;
  data: FlightChartPoint[];
  markLineData: unknown[];
}

@Injectable()
export class FlightLineChartOptionService {
  private readonly timeService = inject(FlightLineChartTimeService);
  private readonly tooltipService = inject(FlightLineChartTooltipService);

  buildChartOption(options: FlightLineChartOptionOptions): EChartsCoreOption {
    const firstTimeSec = this.timeService.getFirstTimeSec(options.data);

    const lastTimeSec =
      options.data.length > 0
        ? options.data[options.data.length - 1].timeSec
        : firstTimeSec;

    const minX = 0;
    const maxX = Math.max(0, lastTimeSec - firstTimeSec);

    const seriesData = options.data.map((p) => [
      p.timeSec - firstTimeSec,
      p.value,
      p.index,
      p.timeSec,
    ]);

    return {
      animation: false,

      grid: {
        left: 48,
        right: 18,
        top: 18,
        bottom: 28,
      },

      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        extraCssText: 'box-shadow: none;',
        formatter: (params: unknown) =>
          this.tooltipService.formatTooltip(params),
      },

      xAxis: {
        type: 'value',
        min: minX,
        max: maxX,
        boundaryGap: false,
        axisLabel: {
          formatter: (value: number) =>
            this.timeService.formatTime(Number(value)),
        },
      },

      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: {
          formatter: `{value} ${options.unit}`,
        },
      },

      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
        },
      ],

      series: [
        {
          id: 'main',
          name: options.title,
          type: 'line',
          showSymbol: false,
          data: seriesData,

          lineStyle: {
            width: 1.5,
          },

          emphasis: {
            disabled: true,
          },

          markLine: this.buildMarkLineOption(options.markLineData),
        },
      ],
    };
  }

  buildMarkLineUpdateOption(markLineData: unknown[]): EChartsCoreOption {
    return {
      series: [
        {
          id: 'main',
          markLine: this.buildMarkLineOption(markLineData),
        },
      ],
    };
  }

  private buildMarkLineOption(markLineData: unknown[]): unknown {
    return {
      silent: true,
      symbol: 'none',
      label: {
        show: false,
      },
      data: markLineData,
    };
  }
}