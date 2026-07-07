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
import { FlightLineChartTooltipService } from './services/flight-line-chart-tooltip.service';
import { FlightLineChartMarkLineService } from './services/flight-line-chart-mark-line.service';
import { FlightLineChartZoomService } from './services/flight-line-chart-zoom.service';
import { FlightLineChartCursorService } from './services/flight-line-chart-cursor.service';

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
  providers: [
    FlightLineChartTimeService,
    FlightLineChartTooltipService,
    FlightLineChartMarkLineService,
    FlightLineChartZoomService,
    FlightLineChartCursorService,
  ],
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
  private readonly tooltipService = inject(FlightLineChartTooltipService);
  private readonly markLineService = inject(FlightLineChartMarkLineService);
  private readonly zoomService = inject(FlightLineChartZoomService);
  private readonly cursorService = inject(FlightLineChartCursorService);

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

    this.cursorService.attachHoverEvents(
      this.chart,
      this.chartContainer.nativeElement,
      () => this.data
    );

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

      const displayedIndex = this.cursorService.getDisplayedTrackIndex();

      if (displayedIndex !== null) {
        this.cursorService.showCursorAtIndex(
          this.chart,
          this.data,
          displayedIndex,
          (cursorTrackIndex) => this.buildMarkLineData(cursorTrackIndex)
        );
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();

    this.cursorService.detachHoverEvents();

    this.chart?.dispose();
    this.chart = null;
  }

  private setupCursorEffect(): void {
    effect(() => {
      this.store.replay();
      this.store.cursorIndex();

      if (!this.chart) {
        return;
      }

      const displayedIndex = this.cursorService.getDisplayedTrackIndex();

      if (displayedIndex === null) {
        this.cursorService.hideCursorLine(
          this.chart,
          (cursorTrackIndex) => this.buildMarkLineData(cursorTrackIndex)
        );

        this.cursorService.hideTooltip(this.chart);
        return;
      }

      this.cursorService.showCursorAtIndex(
        this.chart,
        this.data,
        displayedIndex,
        (cursorTrackIndex) => this.buildMarkLineData(cursorTrackIndex)
      );
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

      this.zoomService.zoomToSelectedClimb(
        this.chart,
        this.data,
        this.store.climbs(),
        selectedClimbId
      );
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

      this.zoomService.zoomToFullFlight(this.chart);
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
            data: this.buildMarkLineData(this.cursorService.getDisplayedTrackIndex()),
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

  private buildMarkLineData(cursorTrackIndex: number | null): unknown[] {
    return this.markLineService.buildMarkLineData({
      data: this.data,
      climbs: this.store.climbs(),
      selectedClimbId: this.store.selectedClimbId(),
      showAllClimbs: this.settingsStore.showClimbsOnCharts(),
      cursorTrackIndex,
    });
  }
}