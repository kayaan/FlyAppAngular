import { Injectable, inject } from '@angular/core';

import { FlightChartPoint } from '../flight-line-chart';
import { FlightLineChartTimeService } from './flight-line-chart-time.service';
import { Climb } from '../../../models/climb.model';

export interface FlightLineChartMarkLineOptions {
  data: FlightChartPoint[];
  climbs: Climb[];
  selectedClimbId: number | null;
  showAllClimbs: boolean;
  cursorTrackIndex: number | null;
}

@Injectable()
export class FlightLineChartMarkLineService {
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

  buildMarkLineData(options: FlightLineChartMarkLineOptions): unknown[] {
    const result: unknown[] = [];

    const visibleClimbs = options.showAllClimbs
      ? options.climbs
      : [];
      
    for (const climb of visibleClimbs) {
      const climbIndex = options.climbs.findIndex(
        (item) => item.id === climb.id
      );

      if (climbIndex < 0) {
        continue;
      }

      const startElapsedSec = this.timeService.getElapsedSecForTrackIndex(
        options.data,
        climb.startIndex
      );

      const endElapsedSec = this.timeService.getElapsedSecForTrackIndex(
        options.data,
        climb.endIndex
      );

      if (startElapsedSec === null || endElapsedSec === null) {
        continue;
      }

      const color =
        this.climbBoundaryColors[climbIndex % this.climbBoundaryColors.length];

      const isSelected = climb.id === options.selectedClimbId;

      result.push(
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

    if (options.cursorTrackIndex !== null) {
      const cursorElapsedSec = this.timeService.getElapsedSecForTrackIndex(
        options.data,
        options.cursorTrackIndex
      );

      if (cursorElapsedSec !== null) {
        result.push({
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

    return result;
  }
}