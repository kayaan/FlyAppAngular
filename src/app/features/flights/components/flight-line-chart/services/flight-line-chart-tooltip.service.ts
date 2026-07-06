import { Injectable } from '@angular/core';

type ChartType = 'altitude' | 'vario' | 'speed';

interface FlightLineChartTooltipItem {
  data?: [number, number, number, number];
  seriesName?: string;
}

@Injectable()
export class FlightLineChartTooltipService {
  formatTooltip(params: unknown): string {
    const items = Array.isArray(params) ? params : [params];

    const first = items[0] as FlightLineChartTooltipItem;
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

  private resolveChartType(seriesName: string): ChartType {
    const normalized = seriesName.toLowerCase();

    if (normalized.includes('vario')) {
      return 'vario';
    }

    if (normalized.includes('speed')) {
      return 'speed';
    }

    return 'altitude';
  }

  private formatTooltipValue(value: number, chartType: ChartType): string {
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
    chartType: ChartType
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
}