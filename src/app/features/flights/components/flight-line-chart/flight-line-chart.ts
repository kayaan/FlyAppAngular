import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
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

  @Input() cursorIndex: number | null = null;

  @Output() cursorIndexChange = new EventEmitter<number | null>();

  @ViewChild('chartContainer', { static: true })
  private chartContainer!: ElementRef<HTMLDivElement>;

  private chart: ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.chart = echarts.init(this.chartContainer.nativeElement);

    this.updateChart();
    this.registerMouseSync();

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

    if (changes['cursorIndex']) {
      this.updateCursor();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();

    if (this.chart) {
      this.chart.getZr().off('mousemove');
      this.chart.getZr().off('globalout');
      this.chart.dispose();
    }

    this.chart = null;
  }


  private registerMouseSync(): void {
    if (!this.chart) {
      return;
    }

    const zr = this.chart.getZr();

    zr.on('mousemove', (event) => {
      if (!this.chart || this.data.length === 0) {
        return;
      }

      const pixel: [number, number] = [event.offsetX, event.offsetY];

      if (!this.chart.containPixel('grid', pixel)) {
        return;
      }

      const converted = this.chart.convertFromPixel(
        { xAxisIndex: 0 },
        pixel
      );

      const dataIndex = this.normalizeDataIndex(converted);

      if (dataIndex == null) {
        return;
      }

      this.cursorIndexChange.emit(this.data[dataIndex].index);
    });

    zr.on('globalout', () => {
      this.cursorIndexChange.emit(null);
    });
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
    this.updateCursor();
  }

  private updateCursor(): void {
    if (!this.chart) {
      return;
    }

    if (this.cursorIndex == null) {
      this.chart.dispatchAction({
        type: 'hideTip',
      });

      this.chart.dispatchAction({
        type: 'updateAxisPointer',
        currTrigger: 'leave',
      });

      return;
    }

    const dataIndex = this.data.findIndex((p) => p.index === this.cursorIndex);

    if (dataIndex < 0) {
      this.chart.dispatchAction({
        type: 'hideTip',
      });

      return;
    }

    this.chart.dispatchAction({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex,
    });

    this.chart.dispatchAction({
      type: 'updateAxisPointer',
      currTrigger: 'mousemove',
      xAxisIndex: 0,
      value: this.data[dataIndex].timeSec,
    });
  }

  private normalizeDataIndex(value: unknown): number | null {
    let rawIndex: number;

    if (Array.isArray(value)) {
      rawIndex = Number(value[0]);
    } else {
      rawIndex = Number(value);
    }

    if (!Number.isFinite(rawIndex)) {
      return null;
    }

    const dataIndex = Math.round(rawIndex);

    if (dataIndex < 0 || dataIndex >= this.data.length) {
      return null;
    }

    return dataIndex;
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