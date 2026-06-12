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

// Register only the ECharts modules used by this component.
// This avoids importing the complete ECharts bundle.
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  AxisPointerComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

// One chart point used by this reusable line chart.
//
// `index` is the original track index.
// This is important because charts, map, cursor and climbs all need
// to refer back to the same original flight fix.
//

// `timeSec` is the original absolute flight time in seconds.
//
// `value` is the displayed value for this chart.
// For example: altitude, vario or speed.
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
  // Chart title shown in tooltip and series name.
  @Input({ required: true }) title = '';

  // Unit shown on y-axis and tooltip.
  // Examples: m, m/s, km/h.
  @Input({ required: true }) unit = '';

  // Chart data.
  // The array can contain smoothed/calculated values,
  // but every point must still keep the original track index.
  @Input({ required: true }) data: FlightChartPoint[] = [];

  // All flight detail charts use the same ECharts group id.
  // This allows ECharts to synchronize tooltip/axis/zoom behavior.
  @Input() groupId = 'flight-detail-charts';

  // Native DOM element where ECharts is mounted.
  @ViewChild('chartContainer', { static: true })
  private chartContainer!: ElementRef<HTMLDivElement>;

  // ECharts instance.
  private chart: ECharts | null = null;

  // Watches container size changes and resizes the chart.
  private resizeObserver: ResizeObserver | null = null;

  // Page-level store.
  // Provides cursor, selected climb and climb list.
  private readonly store = inject(FlightDetailsStore);

  // Global flight settings store.
  // Provides chart display settings like show/hide climbs.
  private readonly settingsStore = inject(FlightSettingsStore);

  // Color palette for climb boundary lines.
  // Consecutive climbs use different colors.
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

  // Current zoom window in percent.
  // We track this manually because when the selected climb changes,
  // we need to know whether it is already visible or whether we need
  // to pan/zoom the chart.
  private currentZoomStartPercent = 0;
  private currentZoomEndPercent = 100;

  // Last selected climb that was handled by this chart.
  // Prevents repeated zooming when unrelated signals update.
  private lastFocusedClimbId: number | null = null;

  private lastZoomToSelectedClimbRequest = 0;

  constructor() {
    effect(() => {
      const cursorIndex = this.store.cursorIndex();
      const selectedClimbId = this.store.selectedClimbId();
      const zoomToSelectedClimbRequest = this.store.zoomToSelectedClimbRequest();

      // These signal reads are intentional.
      // They make this effect re-run when climb visibility or climb data changes.
      this.settingsStore.showClimbsOnCharts();
      this.store.climbs();

      if (!this.chart) {
        return;
      }

      // If the selected climb changed, ensure it is visible.
      // If the selection was cleared, reset the chart to full flight.
      if (selectedClimbId !== this.lastFocusedClimbId) {
        this.lastFocusedClimbId = selectedClimbId;

        if (selectedClimbId !== null) {
          this.ensureSelectedClimbVisible(selectedClimbId);
        } else {
          this.zoomToFullFlight();
        }
      }

      // No active cursor:
      // remove cursor line and hide tooltip.
      if (cursorIndex === null) {
        this.hideCursorLine();
        this.chart.dispatchAction({ type: 'hideTip' });
        return;
      }

      if (
        selectedClimbId !== null &&
        zoomToSelectedClimbRequest !== this.lastZoomToSelectedClimbRequest
      ) {
        this.lastZoomToSelectedClimbRequest = zoomToSelectedClimbRequest;
        this.zoomToSelectedClimb(selectedClimbId);
      }

      // Active cursor:
      // draw vertical cursor line and show tooltip at that track index.
      this.showCursorAtIndex(cursorIndex);
    });
  }

  ngAfterViewInit(): void {
    // Create the ECharts instance after the DOM element exists.
    this.chart = echarts.init(this.chartContainer.nativeElement);

    // Assign the chart to the shared chart group.
    this.chart.group = this.groupId;

    // Initial render.
    this.updateChart();

    // Register mouse hover, axis pointer and zoom listeners.
    this.registerChartHoverEvents();

    // Connect all charts with the same group id.
    echarts.connect(this.groupId);

    // Resize chart when its container changes size.
    // Important because the details page uses a flexible layout.
    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.resize();
    });

    this.resizeObserver.observe(this.chartContainer.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.chart) {
      return;
    }

    // Rebuild chart when inputs change.
    // This happens when resolution/settings change and the parent provides new data.
    if (changes['data'] || changes['title'] || changes['unit']) {
      this.updateChart();

      // Restore cursor after rebuilding chart options.
      const cursorIndex = this.store.cursorIndex();

      if (cursorIndex !== null) {
        this.showCursorAtIndex(cursorIndex);
      }
    }
  }

  ngOnDestroy(): void {
    // Stop observing DOM size changes.
    this.resizeObserver?.disconnect();

    // Dispose ECharts instance to avoid memory leaks.
    this.chart?.dispose();
    this.chart = null;
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
  
  private updateChart(): void {
    if (!this.chart) {
      return;
    }

    const firstTimeSec = this.getFirstTimeSec();

    const lastTimeSec =
      this.data.length > 0
        ? this.data[this.data.length - 1].timeSec
        : firstTimeSec;

    // X-axis is relative flight time.
    // The first point starts at 0 seconds.
    const minX = 0;
    const maxX = Math.max(0, lastTimeSec - firstTimeSec);

    // ECharts data format:
    //
    // [
    //   elapsed flight seconds,
    //   displayed value,
    //   original track index,
    //   original absolute timeSec
    // ]
    //
    // Keeping the original track index inside the point is critical for
    // tooltip sync, map sync and climb boundary lookup.
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
          // No sampling here.
          //
          // ECharts sampling can remove points.
          // That would break stable mapping between:
          // - tooltip point
          // - original track index
          // - map marker
          // - climb start/end lines
          data: seriesData,

          lineStyle: {
            width: 1.5,
          },

          // Disable hover emphasis.
          // We control the cursor/tooltip ourselves via shared store state.
          emphasis: {
            disabled: true,
          },

          // markLine is used for:
          // - climb start line
          // - climb end line
          // - synchronized cursor line
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

    // Replace full chart option.
    // This prevents stale old mark lines or old data from remaining.
    this.chart.setOption(option, true);
  }

  private registerChartHoverEvents(): void {
    if (!this.chart) {
      return;
    }

    // Fired by ECharts when the mouse moves over the x-axis.
    //
    // We receive an elapsed x-axis value and convert it back to the nearest
    // chart data point. From that point we get the original track index.
    //
    // The track index is then stored globally in FlightDetailsStore.
    // Other charts and the map react to the same cursor index.
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

      // Avoid writing the same cursor index again.
      // This reduces unnecessary signal updates.
      if (this.store.cursorIndex() !== trackIndex) {
        this.store.setCursorIndex(trackIndex);
      }
    });

    // Fired when the user zooms or pans the chart.
    //
    // We store the visible zoom window so climb navigation can decide whether:
    // - selected climb is already visible
    // - chart should pan to it
    // - chart should zoom out to fit it
    this.chart.on('dataZoom', (event: any) => {
      const zoom = event.batch?.[0] ?? event;

      if (typeof zoom.start === 'number') {
        this.currentZoomStartPercent = zoom.start;
      }

      if (typeof zoom.end === 'number') {
        this.currentZoomEndPercent = zoom.end;
      }
    });

    // When mouse leaves the chart, clear the shared cursor.
    // This hides cursor lines and tooltips in all connected charts/map.
    this.chartContainer.nativeElement.addEventListener('mouseleave', () => {
      this.store.setCursorIndex(null);
    });
  }

  private buildMarkLineData(cursorTrackIndex: number | null): unknown[] {
    const data: unknown[] = [];

    const climbs = this.store.climbs();
    const selectedClimbId = this.store.selectedClimbId();
    const showAllClimbs = this.settingsStore.showClimbsOnCharts();

    // Decide which climb boundary lines should be visible.
    //
    // If showAllClimbs is true:
    //   show all climb start/end lines.
    //
    // If showAllClimbs is false but a climb is selected:
    //   show only the selected climb.
    //
    // If showAllClimbs is false and no climb is selected:
    //   show no climb lines.
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

      // Climb model stores start/end as original track indices.
      // Chart x-axis uses elapsed seconds.
      // So we must convert track index -> elapsed seconds.
      const startElapsedSec = this.getElapsedSecForTrackIndex(climb.startIndex);
      const endElapsedSec = this.getElapsedSecForTrackIndex(climb.endIndex);

      if (startElapsedSec === null || endElapsedSec === null) {
        continue;
      }

      const color =
        this.climbBoundaryColors[climbIndex % this.climbBoundaryColors.length];

      const isSelected = climb.id === selectedClimbId;

      // Add two dotted vertical lines:
      // - one at climb start
      // - one at climb end
      //
      // The selected climb is drawn stronger.
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
        }
      );
    }

    // Add synchronized cursor line.
    //
    // This is drawn as a markLine instead of relying only on ECharts tooltip
    // axisPointer. That makes the cursor visible even when it is controlled
    // programmatically from another chart or the map.
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

    // Find the chart data item that belongs to the original track index.
    //
    // This is required because the chart x-axis is elapsed seconds,
    // but the shared cursor state is stored as original track index.
    const dataIndex = this.data.findIndex((point) => point.index === trackIndex);

    if (dataIndex < 0) {
      return;
    }

    // Update markLine data so the vertical cursor line is drawn.
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

    // Show tooltip at the synchronized data point.
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

    // Remove only the cursor line.
    //
    // Climb boundary lines are still included because buildMarkLineData(null)
    // still returns climb lines.
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

  private ensureSelectedClimbVisible(selectedClimbId: number): void {
    if (!this.chart || this.data.length === 0) {
      return;
    }

    const selectedClimb = this.store
      .climbs()
      .find((climb) => climb.id === selectedClimbId);

    if (!selectedClimb) {
      return;
    }

    // Convert selected climb boundaries from track index to chart x-axis value.
    const climbStartX = this.getElapsedSecForTrackIndex(selectedClimb.startIndex);
    const climbEndX = this.getElapsedSecForTrackIndex(selectedClimb.endIndex);

    if (climbStartX === null || climbEndX === null) {
      return;
    }

    const fullStartX = 0;
    const fullEndX = this.getMaxElapsedSec();
    const fullRange = fullEndX - fullStartX;

    if (fullRange <= 0) {
      return;
    }

    // Convert current zoom window from percentage to x-axis values.
    const currentStartX =
      fullStartX + (fullRange * this.currentZoomStartPercent) / 100;

    const currentEndX =
      fullStartX + (fullRange * this.currentZoomEndPercent) / 100;

    const currentWindowSize = currentEndX - currentStartX;
    const climbSize = climbEndX - climbStartX;

    // Padding around selected climb.
    // At least 30 seconds, or 20% of climb duration.
    const paddingSec = Math.max(30, climbSize * 0.2);

    const requiredStartX = Math.max(fullStartX, climbStartX - paddingSec);
    const requiredEndX = Math.min(fullEndX, climbEndX + paddingSec);
    const requiredWindowSize = requiredEndX - requiredStartX;

    const isFullyVisible =
      climbStartX >= currentStartX && climbEndX <= currentEndX;

    // If the selected climb is already visible, keep the current zoom.
    if (isFullyVisible) {
      return;
    }

    // If the current zoom window is too small to contain the whole selected climb,
    // zoom out enough to show the climb plus padding.
    if (requiredWindowSize >= currentWindowSize) {
      this.zoomToRange(requiredStartX, requiredEndX);
      return;
    }

    // Otherwise keep the current zoom size and only pan the window
    // so the selected climb becomes centered.
    const climbCenterX = (climbStartX + climbEndX) / 2;

    let nextStartX = climbCenterX - currentWindowSize / 2;
    let nextEndX = climbCenterX + currentWindowSize / 2;

    // Clamp panned window to full flight bounds.
    if (nextStartX < fullStartX) {
      nextStartX = fullStartX;
      nextEndX = fullStartX + currentWindowSize;
    }

    if (nextEndX > fullEndX) {
      nextEndX = fullEndX;
      nextStartX = fullEndX - currentWindowSize;
    }

    this.zoomToRange(nextStartX, nextEndX);
  }

  private zoomToFullFlight(): void {
    if (!this.chart) {
      return;
    }

    // Reset horizontal zoom to full flight.
    this.chart.dispatchAction({
      type: 'dataZoom',
      xAxisIndex: 0,
      start: 0,
      end: 100,
    });

    // Keep manual zoom state in sync.
    this.currentZoomStartPercent = 0;
    this.currentZoomEndPercent = 100;
  }

  private zoomToRange(startX: number, endX: number): void {
    if (!this.chart) {
      return;
    }

    // Zoom to explicit x-axis values.
    // Here x-axis values are elapsed seconds.
    this.chart.dispatchAction({
      type: 'dataZoom',
      xAxisIndex: 0,
      startValue: startX,
      endValue: endX,
    });

    // Update manual zoom state from the explicit x-axis values.
    const fullRange = this.getMaxElapsedSec();

    if (fullRange > 0) {
      this.currentZoomStartPercent = (startX / fullRange) * 100;
      this.currentZoomEndPercent = (endX / fullRange) * 100;
    }
  }

  private getElapsedSecForTrackIndex(trackIndex: number): number | null {
    // Find the chart point that belongs to the original track index.
    //
    // Important:
    // This works only because we do not use ECharts sampling and because
    // every chart point keeps its original track index.
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

    // Linear search is simple and reliable.
    //
    // If tracks become very large, this can later be optimized with binary search,
    // because chart data is sorted by time.
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