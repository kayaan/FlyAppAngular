import { Injectable, inject } from '@angular/core';

import type { ECharts } from 'echarts/core';

import { FlightDetailsStore } from '../../../store/flight-details.store';
import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';

export type FlightLineChartMarkLineDataBuilder = (
  cursorTrackIndex: number | null
) => unknown[];

@Injectable()
export class FlightLineChartCursorService {
  private readonly store = inject(FlightDetailsStore);
  private readonly timeService = inject(FlightLineChartTimeService);

  private chart: ECharts | null = null;
  private chartContainer: HTMLDivElement | null = null;

  private updateAxisPointerHandler: ((event: unknown) => void) | null = null;
  private mouseLeaveHandler: (() => void) | null = null;

  attachHoverEvents(
    chart: ECharts,
    chartContainer: HTMLDivElement,
    getData: () => FlightChartPoint[]
  ): void {
    this.detachHoverEvents();

    this.chart = chart;
    this.chartContainer = chartContainer;

    this.updateAxisPointerHandler = (event: unknown) => {
      if (this.store.replay().active) {
        return;
      }

      const elapsedSec = this.extractElapsedSecFromAxisPointerEvent(event);

      if (elapsedSec === null) {
        return;
      }

      const data = getData();

      const nearestDataIndex =
        this.timeService.findNearestDataIndexByElapsedTime(data, elapsedSec);

      if (nearestDataIndex === null) {
        return;
      }

      const trackIndex = data[nearestDataIndex].index;

      if (this.store.cursorIndex() !== trackIndex) {
        this.store.setCursorIndex(trackIndex);
      }
    };

    this.mouseLeaveHandler = () => {
      if (this.store.replay().active) {
        return;
      }

      this.store.setCursorIndex(null);
    };

    chart.on('updateAxisPointer', this.updateAxisPointerHandler as never);
    chartContainer.addEventListener('mouseleave', this.mouseLeaveHandler);
  }

  detachHoverEvents(): void {
    if (this.chart && this.updateAxisPointerHandler) {
      this.chart.off(
        'updateAxisPointer',
        this.updateAxisPointerHandler as never
      );
    }

    if (this.chartContainer && this.mouseLeaveHandler) {
      this.chartContainer.removeEventListener(
        'mouseleave',
        this.mouseLeaveHandler
      );
    }

    this.chart = null;
    this.chartContainer = null;
    this.updateAxisPointerHandler = null;
    this.mouseLeaveHandler = null;
  }

  getDisplayedTrackIndex(): number | null {
    const replay = this.store.replay();

    if (replay.active && replay.index !== null) {
      return replay.index;
    }

    return this.store.cursorIndex();
  }

  showCursorAtIndex(
    chart: ECharts,
    data: FlightChartPoint[],
    trackIndex: number,
    buildMarkLineData: FlightLineChartMarkLineDataBuilder
  ): void {
    const dataIndex = data.findIndex((point) => point.index === trackIndex);

    if (dataIndex < 0) {
      return;
    }

    chart.setOption({
      series: [
        {
          id: 'main',
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              show: false,
            },
            data: buildMarkLineData(trackIndex),
          },
        },
      ],
    });

    chart.dispatchAction({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex,
    });
  }

  hideCursorLine(
    chart: ECharts,
    buildMarkLineData: FlightLineChartMarkLineDataBuilder
  ): void {
    chart.setOption({
      series: [
        {
          id: 'main',
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              show: false,
            },
            data: buildMarkLineData(null),
          },
        },
      ],
    });
  }

  hideTooltip(chart: ECharts): void {
    chart.dispatchAction({ type: 'hideTip' });

    // ECharts can keep axisPointer/tooltip visually alive after programmatic showTip.
    // This forces the linked chart group to clear the axis pointer too.
    chart.dispatchAction({
      type: 'updateAxisPointer',
      currTrigger: 'leave',
    } as never);
  }

  private extractElapsedSecFromAxisPointerEvent(event: unknown): number | null {
    if (!event || typeof event !== 'object') {
      return null;
    }

    const eventObject = event as {
      axesInfo?: Array<{
        value?: unknown;
      }>;
    };

    const axisInfo = eventObject.axesInfo?.[0];

    if (!axisInfo) {
      return null;
    }

    const elapsedSec = Number(axisInfo.value);

    return Number.isFinite(elapsedSec) ? elapsedSec : null;
  }
}