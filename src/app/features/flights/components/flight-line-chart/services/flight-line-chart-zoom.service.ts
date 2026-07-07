import { Injectable, inject } from '@angular/core';

import type { ECharts } from 'echarts/core';

import { Climb } from '../../../models/climb.model';
import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';

export interface FlightLineChartZoomRange {
  startX: number;
  endX: number;
}

type DataZoomPayload = {
  start?: number;
  end?: number;
  startValue?: number;
  endValue?: number;
};

@Injectable()
export class FlightLineChartZoomService {
  private readonly timeService = inject(FlightLineChartTimeService);

  private currentZoomStartPercent = 0;
  private currentZoomEndPercent = 100;

  private dataZoomHandler: ((event: unknown) => void) | null = null;
  private chart: ECharts | null = null;

  attach(chart: ECharts): void {
    this.detach();

    this.chart = chart;
    this.dataZoomHandler = (event: unknown) => {
      this.rememberDataZoomEvent(event);
    };

    chart.on('dataZoom', this.dataZoomHandler as never);
  }

  detach(): void {
    if (this.chart && this.dataZoomHandler) {
      this.chart.off('dataZoom', this.dataZoomHandler as never);
    }

    this.chart = null;
    this.dataZoomHandler = null;
  }

  getCurrentZoomStartPercent(): number {
    return this.currentZoomStartPercent;
  }

  getCurrentZoomEndPercent(): number {
    return this.currentZoomEndPercent;
  }

  rememberDataZoomEvent(event: unknown): void {
    const zoom = this.extractDataZoomPayload(event);

    if (!zoom) {
      return;
    }

    if (typeof zoom.start === 'number') {
      this.currentZoomStartPercent = this.clampPercent(zoom.start);
    }

    if (typeof zoom.end === 'number') {
      this.currentZoomEndPercent = this.clampPercent(zoom.end);
    }
  }

  zoomToFullFlight(chart: ECharts): void {
    chart.dispatchAction({
      type: 'dataZoom',
      xAxisIndex: 0,
      start: 0,
      end: 100,
    });

    this.currentZoomStartPercent = 0;
    this.currentZoomEndPercent = 100;
  }

  zoomToSelectedClimb(
    chart: ECharts,
    data: FlightChartPoint[],
    climbs: Climb[],
    selectedClimbId: number
  ): void {
    const range = this.getSelectedClimbZoomRange(
      data,
      climbs,
      selectedClimbId
    );

    if (!range) {
      return;
    }

    this.zoomToRange(chart, data, range.startX, range.endX);
  }

  zoomToRange(
    chart: ECharts,
    data: FlightChartPoint[],
    startX: number,
    endX: number
  ): void {
    const safeStartX = Math.min(startX, endX);
    const safeEndX = Math.max(startX, endX);

    chart.dispatchAction({
      type: 'dataZoom',
      xAxisIndex: 0,
      startValue: safeStartX,
      endValue: safeEndX,
    });

    const fullRange = this.timeService.getMaxElapsedSec(data);

    if (fullRange > 0) {
      this.currentZoomStartPercent = this.clampPercent(
        (safeStartX / fullRange) * 100
      );
      this.currentZoomEndPercent = this.clampPercent(
        (safeEndX / fullRange) * 100
      );
    }
  }

  private getSelectedClimbZoomRange(
    data: FlightChartPoint[],
    climbs: Climb[],
    selectedClimbId: number
  ): FlightLineChartZoomRange | null {
    const selectedClimb = climbs.find((climb) => climb.id === selectedClimbId);

    if (!selectedClimb) {
      return null;
    }

    const climbStartX = this.timeService.getElapsedSecForTrackIndex(
      data,
      selectedClimb.startIndex
    );

    const climbEndX = this.timeService.getElapsedSecForTrackIndex(
      data,
      selectedClimb.endIndex
    );

    if (climbStartX === null || climbEndX === null) {
      return null;
    }

    const fullRange = this.timeService.getMaxElapsedSec(data);

    if (fullRange <= 0) {
      return {
        startX: 0,
        endX: 0,
      };
    }

    const climbDurationX = Math.max(0, climbEndX - climbStartX);
    const paddingX = Math.max(30, climbDurationX * 0.25);

    return {
      startX: Math.max(0, climbStartX - paddingX),
      endX: Math.min(fullRange, climbEndX + paddingX),
    };
  }

  private extractDataZoomPayload(event: unknown): DataZoomPayload | null {
    if (!event || typeof event !== 'object') {
      return null;
    }

    const eventObject = event as DataZoomPayload & {
      batch?: DataZoomPayload[];
    };

    if (Array.isArray(eventObject.batch) && eventObject.batch.length > 0) {
      return eventObject.batch[0];
    }

    return eventObject;
  }

  private clampPercent(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, value));
  }
}