// import { Injectable, inject } from '@angular/core';

// import { FlightChartPoint } from '../flight-line-chart';
// import { FlightLineChartTimeService } from './flight-line-chart-time.service';

// interface TooltipItem {
//   seriesName?: string;
//   marker?: string;
//   value?: unknown;
//   data?: unknown;
//   dataIndex?: number;
//   axisValue?: unknown;
// }

// @Injectable()
// export class FlightLineChartTooltipService {
//   private readonly timeService = inject(FlightLineChartTimeService);

//   formatTooltip(params: unknown, data: FlightChartPoint[]): string {
//     const items = Array.isArray(params)
//       ? (params as TooltipItem[])
//       : [params as TooltipItem];

//     if (items.length === 0 || data.length === 0) {
//       return '';
//     }

//     const point = this.getTooltipPoint(items[0], data);

//     if (!point) {
//       return '';
//     }

//     const firstTimeSec = this.timeService.getFirstTimeSec(data);
//     const elapsedSec = point.timeSec - firstTimeSec;

//     const lines = [
//       `<strong>${this.timeService.formatTime(elapsedSec)}</strong>`,
//     ];

//     for (const item of items) {
//       const value = this.getTooltipValue(item, data);

//       if (value === null) {
//         continue;
//       }

//       lines.push(
//         `${item.marker ?? ''}${item.seriesName ?? ''}: ${this.formatValue(
//           item.seriesName,
//           value
//         )}`
//       );
//     }

//     return lines.join('<br>');
//   }

//   private getTooltipPoint(
//     item: TooltipItem,
//     data: FlightChartPoint[]
//   ): FlightChartPoint | null {
//     if (
//       typeof item.dataIndex === 'number' &&
//       item.dataIndex >= 0 &&
//       item.dataIndex < data.length
//     ) {
//       return data[item.dataIndex];
//     }

//     const elapsedSec = this.getFirstNumber(item.value) ?? this.getFirstNumber(item.data);

//     if (elapsedSec !== null) {
//       const dataIndex = this.timeService.findNearestDataIndexByElapsedTime(
//         data,
//         elapsedSec
//       );

//       return dataIndex === null ? null : data[dataIndex];
//     }

//     if (typeof item.axisValue === 'number') {
//       const dataIndex = this.timeService.findNearestDataIndexByElapsedTime(
//         data,
//         item.axisValue
//       );

//       return dataIndex === null ? null : data[dataIndex];
//     }

//     return null;
//   }

//   private getTooltipValue(
//     item: TooltipItem,
//     data: FlightChartPoint[]
//   ): number | null {
//     const directValue = this.getSecondNumber(item.value) ?? this.getSecondNumber(item.data);

//     if (directValue !== null) {
//       return directValue;
//     }

//     if (
//       typeof item.dataIndex === 'number' &&
//       item.dataIndex >= 0 &&
//       item.dataIndex < data.length
//     ) {
//       const point = data[item.dataIndex];

// switch (item.seriesName) {
//   case 'Altitude':
//   case 'GPS Altitude':
//   case 'Baro Altitude':
//     return point.altitudeM;

//   case 'Vario':
//   case 'Vertical speed':
//   case 'Vario m/s':
//     return point.varioMs;

//   case 'Speed':
//   case 'Speed km/h':
//     return point.speedKmh;

//   default:
//     return null;
// }
//     }

//     return null;
//   }



//   private getFirstNumber(value: unknown): number | null {
//     if (typeof value === 'number') {
//       return value;
//     }

//     if (Array.isArray(value)) {
//       const first = value[0];
//       return typeof first === 'number' ? first : null;
//     }

//     return null;
//   }

//   private getSecondNumber(value: unknown): number | null {
//     if (typeof value === 'number') {
//       return value;
//     }

//     if (Array.isArray(value)) {
//       const second = value[1];
//       return typeof second === 'number' ? second : null;
//     }

//     return null;
//   }

//   private formatValue(seriesName: string | undefined, value: number): string {
//     switch (seriesName) {
//       case 'Altitude':
//       case 'GPS Altitude':
//       case 'Baro Altitude':
//         return `${Math.round(value)} m`;

//       case 'Vario':
//       case 'Vertical speed':
//       case 'Vario m/s':
//         return `${value > 0 ? '+' : ''}${value.toFixed(1)} m/s`;

//       case 'Speed':
//       case 'Speed km/h':
//         return `${Math.round(value)} km/h`;

//       default:
//         return Number.isInteger(value)
//           ? value.toString()
//           : value.toFixed(1);
//     }
//   }
// }