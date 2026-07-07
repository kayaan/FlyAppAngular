import { Injectable, inject } from '@angular/core';

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

  getSelectedClimbZoomRange(
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
}