import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

export interface FlightChartPoint {
  index: number;
  timeSec: number;
  value: number;
}

@Component({
  selector: 'app-flight-line-chart',
  standalone: true,
  templateUrl: './flight-line-chart.html',
  styleUrl: './flight-line-chart.scss',
})
export class FlightLineChart implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) title = '';
  @Input({ required: true }) unit = '';
  @Input({ required: true }) data: FlightChartPoint[] = [];

  @ViewChild('chartContainer', { static: true })
  private chartContainer!: ElementRef<HTMLDivElement>;

  private chart: ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.chart = echarts.init(this.chartContainer.nativeElement);
    this.updateChart();

    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.resize();
    });

    this.resizeObserver.observe(this.chartContainer.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.chart) {
      return;
    }

    if (changes['data'] || changes['title'] || changes['unit']) {
      this.updateChart();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
  }

  private updateChart(): void {
    if (!this.chart) {
      return;
    }

    const option: EChartsCoreOption = {
      animation: false,

      grid: {
        left: 48,
        right: 18,
        top: 18,
        bottom: 28,
      },

      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
        },
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params : [params];
          const first = items[0] as any;

          if (!first?.data) {
            return '';
          }

          const point = first.data as FlightChartPoint;
          const time = this.formatTime(point.timeSec);

          return `
            <strong>${this.title}</strong><br/>
            Time: ${time}<br/>
            Value: ${point.value.toFixed(1)} ${this.unit}
          `;
        },
      },

      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: this.data.map((p) => p.timeSec),
        axisLabel: {
          formatter: (value: number) => this.formatTime(Number(value)),
        },
      },

      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: {
          formatter: `{value} ${this.unit}`,
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
          name: this.title,
          type: 'line',
          showSymbol: false,
          sampling: 'lttb',
          data: this.data,
          encode: {
            x: 'timeSec',
            y: 'value',
          },
          lineStyle: {
            width: 1.5,
          },
        },
      ],
    };

    this.chart.setOption(option, true);
  }

  private formatTime(timeSec: number): string {
    const hours = Math.floor(timeSec / 3600);
    const minutes = Math.floor((timeSec % 3600) / 60);
    const seconds = Math.floor(timeSec % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}