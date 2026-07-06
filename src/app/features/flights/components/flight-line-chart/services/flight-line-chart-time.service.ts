import { Injectable } from '@angular/core';

import { FlightChartPoint } from '../flight-line-chart';

@Injectable()
export class FlightLineChartTimeService {
  getFirstTimeSec(data: FlightChartPoint[]): number {
    return data.length > 0 ? data[0].timeSec : 0;
  }

  getMaxElapsedSec(data: FlightChartPoint[]): number {
    if (data.length === 0) {
      return 0;
    }

    const firstTimeSec = this.getFirstTimeSec(data);
    const lastTimeSec = data[data.length - 1].timeSec;

    return Math.max(0, lastTimeSec - firstTimeSec);
  }

  getElapsedSecForTrackIndex(
    data: FlightChartPoint[],
    trackIndex: number
  ): number | null {
    const point = data.find((item) => item.index === trackIndex);

    if (!point) {
      return null;
    }

    return point.timeSec - this.getFirstTimeSec(data);
  }

  findNearestDataIndexByElapsedTime(
    data: FlightChartPoint[],
    elapsedSec: number
  ): number | null {
    if (data.length === 0) {
      return null;
    }

    const firstTimeSec = this.getFirstTimeSec(data);

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < data.length; i++) {
      const pointElapsedSec = data[i].timeSec - firstTimeSec;
      const distance = Math.abs(pointElapsedSec - elapsedSec);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  formatTime(timeSec: number): string {
    const safeTimeSec = Math.max(0, Math.floor(timeSec));

    const hours = Math.floor(safeTimeSec / 3600);
    const minutes = Math.floor((safeTimeSec % 3600) / 60);
    const seconds = safeTimeSec % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}