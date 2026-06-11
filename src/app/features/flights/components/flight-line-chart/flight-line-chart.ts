import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  inject,
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
  AxisPointerComponent,
  MarkLineComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightSettingsStore } from '../../store/flight-settings.store';

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  AxisPointerComponent,
  MarkLineComponent,
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

  @Input() groupId = 'flight-detail-charts';

  @ViewChild('chartContainer', { static: true })
  private chartContainer!: ElementRef<HTMLDivElement>;

  private chart: ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private readonly store = inject(FlightDetailsStore);
  private readonly settingsStore = inject(FlightSettingsStore);

  private readonly climbBoundaryColors = [
    '#2563eb',
    '#16a34a',
    '#dc2626',
    '#9333ea',
    '#ea580c',
    '#0891b2',
    '#4f46e5',
    '#be123c',
  ];

  constructor() {
    effect(() => {
      const cursorIndex = this.store.cursorIndex();

      this.settingsStore.showClimbsOnCharts();
      this.store.climbs();
      this.store.selectedClimbId();

      if (!this.chart) {
        return;
      }

      if (cursorIndex === null) {
        this.hideCursorLine();
        this.chart.dispatchAction({ type: 'hideTip' });
        return;
      }

      this.showCursorAtIndex(cursorIndex);
    });
  }
  
  ngAfterViewInit(): void {
    this.chart = echarts.init(this.chartContainer.nativeElement);
    this.chart.group = this.groupId;

    this.updateChart();
    this.registerChartHoverEvents();

    echarts.connect(this.groupId);

    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.resize();
    });

    this.resizeObserver.observe(this.chartContainer.nativeElement);
  }

  private buildMarkLineData(cursorTrackIndex: number | null): unknown[] {
    const data: unknown[] = [];

    if (this.settingsStore.showClimbsOnCharts()) {
      const climbs = this.store.climbs();

      for (let i = 0; i < climbs.length; i++) {
        const climb = climbs[i];

        const startElapsedSec = this.getElapsedSecForTrackIndex(climb.startIndex);
        const endElapsedSec = this.getElapsedSecForTrackIndex(climb.endIndex);

        if (startElapsedSec === null || endElapsedSec === null) {
          continue;
        }

        const color =
          this.climbBoundaryColors[i % this.climbBoundaryColors.length];

        const isSelected = climb.id === this.store.selectedClimbId();

        data.push(
          {
            xAxis: startElapsedSec,
            lineStyle: {
              color,
              type: 'dashed',
              width: isSelected ? 2 : 1,
              opacity: isSelected ? 1 : 0.75,
            },
            label: {
              show: false,
            },
          },
          {
            xAxis: endElapsedSec,
            lineStyle: {
              color,
              type: 'dashed',
              width: isSelected ? 2 : 1,
              opacity: isSelected ? 1 : 0.75,
            },
            label: {
              show: false,
            },
          }
        );
      }
    }

    if (cursorTrackIndex !== null) {
      const cursorElapsedSec = this.getElapsedSecForTrackIndex(cursorTrackIndex);

      if (cursorElapsedSec !== null) {
        data.push({
          xAxis: cursorElapsedSec,
          lineStyle: {
            type: 'solid',
            width: 1,
            color: '#101828',
            opacity: 0.9,
          },
          label: {
            show: false,
          },
        });
      }
    }

    return data;
  }

  private getElapsedSecForTrackIndex(trackIndex: number): number | null {
    const point = this.data.find((item) => item.index === trackIndex);

    if (!point) {
      return null;
    }

    return point.timeSec - this.getFirstTimeSec();
  }

  private registerChartHoverEvents(): void {
    if (!this.chart) {
      return;
    }

    this.chart.on('updateAxisPointer', (event: any) => {
      const axisInfo = event.axesInfo?.[0];

      if (!axisInfo) {
        return;
      }

      const elapsedSec = Number(axisInfo.value);

      if (!Number.isFinite(elapsedSec)) {
        return;
      }

      const nearestDataIndex = this.findNearestDataIndexByElapsedTime(elapsedSec);

      if (nearestDataIndex === null) {
        return;
      }

      const trackIndex = this.data[nearestDataIndex].index;

      if (this.store.cursorIndex() !== trackIndex) {
        this.store.setCursorIndex(trackIndex);
      }
    });

    this.chartContainer.nativeElement.addEventListener('mouseleave', () => {
      this.store.setCursorIndex(null);
    });
  }

  private findNearestDataIndexByElapsedTime(elapsedSec: number): number | null {
    if (this.data.length === 0) {
      return null;
    }

    const firstTimeSec = this.getFirstTimeSec();

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this.data.length; i++) {
      const pointElapsedSec = this.data[i].timeSec - firstTimeSec;
      const distance = Math.abs(pointElapsedSec - elapsedSec);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.chart) {
      return;
    }

    if (changes['data'] || changes['title'] || changes['unit']) {
      this.updateChart();

      const cursorIndex = this.store.cursorIndex();

      if (cursorIndex !== null) {
        this.showCursorAtIndex(cursorIndex);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
    this.chart = null;
  }

  private updateChart(): void {
    if (!this.chart) {
      return;
    }

    const firstTimeSec = this.getFirstTimeSec();
    const lastTimeSec =
      this.data.length > 0 ? this.data[this.data.length - 1].timeSec : firstTimeSec;

    const minX = 0;
    const maxX = Math.max(0, lastTimeSec - firstTimeSec);

    const seriesData = this.data.map((p) => [
      p.timeSec - firstTimeSec,
      p.value,
      p.index,
      p.timeSec,
    ]);

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
        confine: true,
        axisPointer: {
          type: 'line',
          snap: false,
        },
        formatter: (params: unknown) => {
          const items = Array.isArray(params) ? params : [params];
          const first = items[0] as any;

          if (!first?.data) {
            return '';
          }

          const [elapsedSec, value, index, originalTimeSec] = first.data as [
            number,
            number,
            number,
            number,
          ];

          return `
            <strong>${this.title}</strong><br/>
            Flight time: ${this.formatTime(elapsedSec)}<br/>
            Time: ${this.formatTime(originalTimeSec)}<br/>
            Value: ${value.toFixed(1)} ${this.unit}
          `;
        },
      },

      xAxis: {
        type: 'value',
        min: minX,
        max: maxX,
        boundaryGap: false,
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
          id: 'main',
          name: this.title,
          type: 'line',
          showSymbol: false,

          // Important:
          // No sampling here. We need stable point/index mapping
          // for tooltip, chart sync and map sync.
          data: seriesData,

          lineStyle: {
            width: 1.5,
          },

          emphasis: {
            disabled: true,
          },

          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              show: false,
            },
            data: this.buildMarkLineData(this.store.cursorIndex()),
          },
        },
      ],
    };

    this.chart.setOption(option, true);
  }

  private showCursorAtIndex(trackIndex: number): void {
    if (!this.chart) {
      return;
    }

    const dataIndex = this.data.findIndex((point) => point.index === trackIndex);

    if (dataIndex < 0) {
      return;
    }

    const firstTimeSec = this.getFirstTimeSec();
    const point = this.data[dataIndex];
    const elapsedSec = point.timeSec - firstTimeSec;

    this.chart.setOption({
      series: [
        {
          id: 'main',
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              show: false,
            },
            data: this.buildMarkLineData(trackIndex),
          },
        },
      ],
    });

    this.chart.dispatchAction({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex,
    });
  }

  private hideCursorLine(): void {
    if (!this.chart) {
      return;
    }

    this.chart.setOption({
      series: [
        {
          id: 'main',
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              show: false,
            },
            data: this.buildMarkLineData(null),
          },
        },
      ],
    });
  }
  private getFirstTimeSec(): number {
    return this.data.length > 0 ? this.data[0].timeSec : 0;
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