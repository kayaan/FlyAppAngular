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
  untracked,
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

  private currentZoomStartPercent = 0;
  private currentZoomEndPercent = 100;

  private lastZoomToSelectedClimbRequest = 0;
  private lastResetChartZoomRequest = 0;

  constructor() {
    this.setupCursorEffect();
    this.setupZoomToSelectedClimbEffect();
    this.setupResetChartZoomEffect();
    this.setupClimbOverlayEffect();
    this.setupReplayTooltipTriggerEffect();
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

  private setupReplayTooltipTriggerEffect(): void {
    effect(() => {
      const isReplayPlaying = this.store.isReplayPlaying();

      if (!this.chart) {
        return;
      }

      this.chart.setOption({
        tooltip: {
          triggerOn: isReplayPlaying ? 'none' : 'mousemove|click',
        },
      });
    });
  }

  private setupCursorEffect(): void {
    effect(() => {
      const cursorIndex = this.store.cursorIndex();

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

  private setupZoomToSelectedClimbEffect(): void {
    effect(() => {
      const request = this.store.zoomToSelectedClimbRequest();

      if (!this.chart) {
        return;
      }

      if (request === 0 || request === this.lastZoomToSelectedClimbRequest) {
        return;
      }

      this.lastZoomToSelectedClimbRequest = request;

      const selectedClimbId = untracked(() => this.store.selectedClimbId());

      if (selectedClimbId === null) {
        return;
      }

      this.zoomToSelectedClimb(selectedClimbId);
    });
  }

  private setupResetChartZoomEffect(): void {
    effect(() => {
      const request = this.store.resetChartZoomRequest();

      if (!this.chart) {
        return;
      }

      if (request === 0 || request === this.lastResetChartZoomRequest) {
        return;
      }

      this.lastResetChartZoomRequest = request;

      this.zoomToFullFlight();
    });
  }

  private setupClimbOverlayEffect(): void {
    effect(() => {
      this.settingsStore.showClimbsOnCharts();
      this.store.climbs();
      this.store.selectedClimbId();

      if (!this.chart) {
        return;
      }

      this.updateChartOptions();
    });
  }

  private updateChartOptions(): void {
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
            data: this.buildMarkLineData(this.store.cursorIndex()),
          },
        },
      ],
    });
  }

  private updateChart(): void {
    if (!this.chart) {
      return;
    }

    const firstTimeSec = this.getFirstTimeSec();

    const lastTimeSec =
      this.data.length > 0
        ? this.data[this.data.length - 1].timeSec
        : firstTimeSec;

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
        triggerOn: this.store.isReplayPlaying() ? 'none' : 'mousemove|click',
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
            Index: ${index}<br/>
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

  private registerChartHoverEvents(): void {
    if (!this.chart) {
      return;
    }

    this.chart.on('updateAxisPointer', (event: any) => {
      if (this.shouldIgnorePointerInput()) {
        return;
      }

      const axisInfo = event.axesInfo?.[0];

      if (!axisInfo) {
        return;
      }

      const elapsedSec = Number(axisInfo.value);

      if (!Number.isFinite(elapsedSec)) {
        return;
      }

      const nearestDataIndex =
        this.findNearestDataIndexByElapsedTime(elapsedSec);

      if (nearestDataIndex === null) {
        return;
      }

      const trackIndex = this.data[nearestDataIndex].index;

      if (this.store.cursorIndex() !== trackIndex) {
        this.store.setCursorIndex(trackIndex);
      }
    });

    this.chart.on('dataZoom', (event: any) => {
      const zoom = event.batch?.[0] ?? event;

      if (typeof zoom.start === 'number') {
        this.currentZoomStartPercent = zoom.start;
      }

      if (typeof zoom.end === 'number') {
        this.currentZoomEndPercent = zoom.end;
      }
    });

    this.chartContainer.nativeElement.addEventListener('mouseleave', () => {
      if (this.shouldIgnorePointerInput()) {
        return;
      }

      this.store.setCursorIndex(null);
    });
  }

  private shouldIgnorePointerInput(): boolean {
    return this.store.isReplayPlaying();
  }

  private buildMarkLineData(cursorTrackIndex: number | null): unknown[] {
    const data: unknown[] = [];

    const climbs = this.store.climbs();
    const selectedClimbId = this.store.selectedClimbId();
    const showAllClimbs = this.settingsStore.showClimbsOnCharts();

    const visibleClimbs = showAllClimbs
      ? climbs
      : selectedClimbId !== null
        ? climbs.filter((climb) => climb.id === selectedClimbId)
        : [];

    for (const climb of visibleClimbs) {
      const climbIndex = climbs.findIndex((item) => item.id === climb.id);

      if (climbIndex < 0) {
        continue;
      }

      const startElapsedSec = this.getElapsedSecForTrackIndex(climb.startIndex);
      const endElapsedSec = this.getElapsedSecForTrackIndex(climb.endIndex);

      if (startElapsedSec === null || endElapsedSec === null) {
        continue;
      }

      const color =
        this.climbBoundaryColors[climbIndex % this.climbBoundaryColors.length];

      const isSelected = climb.id === selectedClimbId;

      data.push(
        {
          xAxis: startElapsedSec,
          lineStyle: {
            color,
            type: 'dotted',
            width: isSelected ? 2.5 : 1.5,
            opacity: isSelected ? 1 : 0.65,
          },
          label: {
            show: false,
          },
        },
        {
          xAxis: endElapsedSec,
          lineStyle: {
            color,
            type: 'dotted',
            width: isSelected ? 2.5 : 1.5,
            opacity: isSelected ? 1 : 0.65,
          },
          label: {
            show: false,
          },
        },
      );
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

  private showCursorAtIndex(trackIndex: number): void {
    if (!this.chart) {
      return;
    }

    const dataIndex = this.data.findIndex((point) => point.index === trackIndex);

    if (dataIndex < 0) {
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

  private zoomToSelectedClimb(selectedClimbId: number): void {
    const selectedClimb = this.store
      .climbs()
      .find((climb) => climb.id === selectedClimbId);

    if (!selectedClimb) {
      return;
    }

    const climbStartX = this.getElapsedSecForTrackIndex(selectedClimb.startIndex);
    const climbEndX = this.getElapsedSecForTrackIndex(selectedClimb.endIndex);

    if (climbStartX === null || climbEndX === null) {
      return;
    }

    const fullStartX = 0;
    const fullEndX = this.getMaxElapsedSec();

    const climbSize = climbEndX - climbStartX;
    const paddingSec = Math.max(30, climbSize * 0.2);

    const startX = Math.max(fullStartX, climbStartX - paddingSec);
    const endX = Math.min(fullEndX, climbEndX + paddingSec);

    this.zoomToRange(startX, endX);
  }

  private zoomToFullFlight(): void {
    if (!this.chart) {
      return;
    }

    this.chart.dispatchAction({
      type: 'dataZoom',
      xAxisIndex: 0,
      start: 0,
      end: 100,
    });

    this.currentZoomStartPercent = 0;
    this.currentZoomEndPercent = 100;
  }

  private zoomToRange(startX: number, endX: number): void {
    if (!this.chart) {
      return;
    }

    this.chart.dispatchAction({
      type: 'dataZoom',
      xAxisIndex: 0,
      startValue: startX,
      endValue: endX,
    });

    const fullRange = this.getMaxElapsedSec();

    if (fullRange > 0) {
      this.currentZoomStartPercent = (startX / fullRange) * 100;
      this.currentZoomEndPercent = (endX / fullRange) * 100;
    }
  }

  private getElapsedSecForTrackIndex(trackIndex: number): number | null {
    const point = this.data.find((item) => item.index === trackIndex);

    if (!point) {
      return null;
    }

    return point.timeSec - this.getFirstTimeSec();
  }

  private getMaxElapsedSec(): number {
    if (this.data.length === 0) {
      return 0;
    }

    const firstTimeSec = this.getFirstTimeSec();
    const lastTimeSec = this.data[this.data.length - 1].timeSec;

    return Math.max(0, lastTimeSec - firstTimeSec);
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