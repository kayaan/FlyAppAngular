import { Injectable, inject } from '@angular/core';

import type { ECharts } from 'echarts/core';

import { Climb } from '../../../models/climb.model';
import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';

export interface FlightLineChartZoomRange {
  startX: number;
  endX: number;
}

@Injectable()
export class FlightLineChartZoomService {
  private readonly timeService = inject(FlightLineChartTimeService);

  private currentZoomStartPercent = 0;
  private currentZoomEndPercent = 100;

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

    if (typeof zoom['start'] === 'number') {
      this.currentZoomStartPercent = zoom['start'];
    }

    if (typeof zoom['end'] === 'number') {
      this.currentZoomEndPercent = zoom['end'];
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
    chart.dispatchAction({
      type: 'dataZoom',
      xAxisIndex: 0,
      startValue: startX,
      endValue: endX,
    });

    const fullRange = this.timeService.getMaxElapsedSec(data);

    if (fullRange > 0) {
      this.currentZoomStartPercent = (startX / fullRange) * 100;
      this.currentZoomEndPercent = (endX / fullRange) * 100;
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

    const fullStartX = 0;
    const fullEndX = this.timeService.getMaxElapsedSec(data);

    const climbSize = climbEndX - climbStartX;
    const paddingSec = Math.max(30, climbSize * 0.2);

    return {
      startX: Math.max(fullStartX, climbStartX - paddingSec),
      endX: Math.min(fullEndX, climbEndX + paddingSec),
    };
  }

  private extractDataZoomPayload(
    event: unknown
  ): Record<string, unknown> | null {
    if (!event || typeof event !== 'object') {
      return null;
    }

    const eventObject = event as Record<string, unknown>;
    const batch = eventObject['batch'];

    if (Array.isArray(batch) && batch.length > 0) {
      const firstBatchItem = batch[0];

      return firstBatchItem && typeof firstBatchItem === 'object'
        ? (firstBatchItem as Record<string, unknown>)
        : null;
    }

    return eventObject;
  }
}