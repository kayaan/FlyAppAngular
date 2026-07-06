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
import { FlightLineChartTimeService } from './services/flight-line-chart-time.service';

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
  providers: [FlightLineChartTimeService],
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
  private readonly timeService = inject(FlightLineChartTimeService);

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

      const displayedIndex = this.getDisplayedTrackIndex();

      if (displayedIndex !== null) {
        this.showCursorAtIndex(displayedIndex);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();

    this.chart?.dispose();
    this.chart = null;
  }

  private setupCursorEffect(): void {
    effect(() => {
      const replay = this.store.replay();
      const cursorIndex = this.store.cursorIndex();

      if (!this.chart) {
        return;
      }

      const displayedIndex =
        replay.active && replay.index !== null
          ? replay.index
          : cursorIndex;

      if (displayedIndex === null) {
        this.hideCursorLine();
        this.hideTooltip();
        return;
      }

      this.showCursorAtIndex(displayedIndex);
    });
  }

  private hideTooltip(): void {
    if (!this.chart) {
      return;
    }

    this.chart.dispatchAction({ type: 'hideTip' });

    // ECharts can keep axisPointer/tooltip visually alive after programmatic showTip.
    // This forces the linked chart group to clear the axis pointer too.
    this.chart.dispatchAction({
      type: 'updateAxisPointer',
      currTrigger: 'leave',
    } as any);
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

      // Important:
      // selectedClimbId may change during climb navigation.
      // This effect may update markLines, but it must never zoom.
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
            data: this.buildMarkLineData(this.getDisplayedTrackIndex()),
          },
        },
      ],
    });
  }

  private updateChart(): void {
    if (!this.chart) {
      return;
    }

    const firstTimeSec = this.timeService.getFirstTimeSec(this.data);

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
        confine: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        extraCssText: 'box-shadow: none;',
        formatter: (params: unknown) => this.formatTooltip(params),
      },

      xAxis: {
        type: 'value',
        min: minX,
        max: maxX,
        boundaryGap: false,
        axisLabel: {
          formatter: (value: number) => this.timeService.formatTime(Number(value)),
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

  private formatTooltip(params: unknown): string {
    const items = Array.isArray(params) ? params : [params];

    const first = items[0] as {
      data?: [number, number, number, number];
      seriesName?: string;
    };

    const data = first.data;

    if (!data) {
      return '';
    }

    const elapsedSec = Number(data[0]);
    const value = Number(data[1]);
    const absoluteTimeSec = Number(data[3]);

    if (
      !Number.isFinite(elapsedSec) ||
      !Number.isFinite(value) ||
      !Number.isFinite(absoluteTimeSec)
    ) {
      return '';
    }

    const chartType = this.resolveChartType(first.seriesName ?? '');
    const formattedValue = this.formatTooltipValue(value, chartType);
    const valueClass = this.resolveTooltipValueClass(value, chartType);

    const flightTime = this.formatDuration(elapsedSec);
    const clockTime = this.formatClockTime(absoluteTimeSec);

    return `
    <div class="chart-tooltip">
      <div class="chart-tooltip-value ${valueClass}">
        ${formattedValue}
      </div>
      <div class="chart-tooltip-time">
        ${flightTime} · ${clockTime}
      </div>
    </div>
  `;
  }

  private formatClockTime(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));

    const hours = Math.floor((safeSeconds % 86400) / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  }

  private resolveChartType(seriesName: string): 'altitude' | 'vario' | 'speed' {
    const normalized = seriesName.toLowerCase();

    if (normalized.includes('vario')) {
      return 'vario';
    }

    if (normalized.includes('speed')) {
      return 'speed';
    }

    return 'altitude';
  }

  private formatTooltipValue(
    value: number,
    chartType: 'altitude' | 'vario' | 'speed'
  ): string {
    if (chartType === 'altitude') {
      return `${Math.round(value).toLocaleString('en-US')} m`;
    }

    if (chartType === 'vario') {
      const sign = value > 0 ? '+' : '';
      return `${sign}${value.toFixed(1)} m/s`;
    }

    return `${Math.round(value)} km/h`;
  }

  private resolveTooltipValueClass(
    value: number,
    chartType: 'altitude' | 'vario' | 'speed'
  ): string {
    if (chartType === 'altitude') {
      return 'altitude';
    }

    if (chartType === 'speed') {
      return 'speed';
    }

    return value >= 0 ? 'vario-positive' : 'vario-negative';
  }

  private formatDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));

    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  }

  private getDisplayedTrackIndex(): number | null {
    const replay = this.store.replay();

    if (replay.active && replay.index !== null) {
      return replay.index;
    }

    return this.store.cursorIndex();
  }

  private registerChartHoverEvents(): void {
    if (this.store.replay().active) {
      return;
    }

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

      const nearestDataIndex = this.timeService.findNearestDataIndexByElapsedTime(this.data, elapsedSec);

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
      if (this.store.replay().active) {
        return;
      }

      this.store.setCursorIndex(null);
    });
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

      const startElapsedSec = this.timeService. getElapsedSecForTrackIndex(this.data, climb.startIndex);
      const endElapsedSec = this.timeService.getElapsedSecForTrackIndex(this.data, climb.endIndex);

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
      const cursorElapsedSec = this.timeService.getElapsedSecForTrackIndex(this.data, cursorTrackIndex);

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

    const climbStartX = this.timeService.getElapsedSecForTrackIndex(this.data, selectedClimb.startIndex);
    const climbEndX = this.timeService.getElapsedSecForTrackIndex(this.data, selectedClimb.endIndex);

    if (climbStartX === null || climbEndX === null) {
      return;
    }

    const fullStartX = 0;
    const fullEndX = this.timeService.getMaxElapsedSec(this.data);

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

    const fullRange = this.timeService.getMaxElapsedSec(this.data);

    if (fullRange > 0) {
      this.currentZoomStartPercent = (startX / fullRange) * 100;
      this.currentZoomEndPercent = (endX / fullRange) * 100;
    }
  }
}