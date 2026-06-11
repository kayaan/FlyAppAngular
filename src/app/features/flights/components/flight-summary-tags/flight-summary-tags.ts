import { Component, computed, inject } from '@angular/core';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightSettingsStore } from '../../store/flight-settings.store';
import { DerivedFlightStats } from '../../models/derived-flight-stats.model';

type SummaryMetric = {
  label: string;
  value: string;
};

type SummaryViewModel = {
  scopeLabel: string;
  timeLabel: string;
  metrics: SummaryMetric[];
  compactMetrics: SummaryMetric[];
};

@Component({
  selector: 'app-flight-summary-tags',
  standalone: true,
  templateUrl: './flight-summary-tags.html',
  styleUrl: './flight-summary-tags.scss',
})
export class FlightSummaryTags {
  private readonly store = inject(FlightDetailsStore);
  private readonly settingsStore = inject(FlightSettingsStore);

  readonly showStatsPanel = this.settingsStore.showStatsPanel;

  readonly vm = computed<SummaryViewModel | null>(() => {
    const stats = this.store.derivedStats();

    if (!stats) {
      return null;
    }

    const metrics: SummaryMetric[] = [
      {
        label: 'Duration',
        value: this.formatDuration(stats.durationSec),
      },
      {
        label: 'Distance',
        value: this.formatKm(stats.distanceM),
      },
      {
        label: 'Height Min / Max',
        value: `${this.formatNumber(stats.altitudeMinM)} / ${this.formatNumber(
          stats.altitudeMaxM
        )} m`,
      },
      {
        label: 'Δ Altitude',
        value: this.formatSignedMeters(stats.altitudeDeltaM),
      },
      {
        label: 'Gain / Loss',
        value: `+${this.formatNumber(stats.altitudeGainM)} / -${this.formatNumber(
          stats.altitudeLossM
        )} m`,
      },
      {
        label: 'Avg vario',
        value: this.formatMs(stats.avgVarioMs),
      },
      {
        label: 'Vario Min / Max',
        value: this.formatVarioRange(stats),
      },
      {
        label: 'Avg speed',
        value: this.formatKmh(stats.avgSpeedKmh),
      },
      {
        label: 'Max speed',
        value: this.formatKmh(stats.maxSpeedKmh),
      },
      {
        label: 'Climbs',
        value: `${stats.climbCount}`,
      },
      {
        label: 'Fixes',
        value: `${stats.fixCount}`,
      },
    ];

    return {
      scopeLabel: this.getScopeLabel(stats),
      timeLabel: this.getTimeLabel(stats),
      metrics,
      compactMetrics: metrics.slice(0, 3),
    };
  });

  toggleStatsPanel(): void {
    this.settingsStore.setShowStatsPanel(!this.settingsStore.showStatsPanel());
  }

  private getScopeLabel(stats: DerivedFlightStats): string {
    if (stats.scopeType === 'climb') {
      return 'CLIMB';
    }

    if (stats.scopeType === 'range') {
      return 'RANGE';
    }

    return 'FLIGHT';
  }

  private getTimeLabel(stats: DerivedFlightStats): string {
    return `${this.formatRelativeTime(stats.startTimeSec)} → ${this.formatRelativeTime(
      stats.endTimeSec
    )}`;
  }

  private formatVarioRange(stats: DerivedFlightStats): string {
    if (!this.hasNumber(stats.minVarioMs) || !this.hasNumber(stats.maxVarioMs)) {
      return '—';
    }

    return `${this.formatDecimal(stats.minVarioMs, 1)} / ${this.formatDecimal(
      stats.maxVarioMs,
      1
    )} m/s`;
  }

  private formatDuration(seconds: number | null): string {
    if (!this.hasNumber(seconds)) {
      return '—';
    }

    const totalSeconds = Math.max(0, Math.round(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }

  private formatRelativeTime(seconds: number | null): string {
    return this.formatDuration(seconds);
  }

  private formatSignedMeters(value: number | null): string {
    if (!this.hasNumber(value)) {
      return '—';
    }

    const rounded = Math.round(value);
    const sign = rounded > 0 ? '+' : '';

    return `${sign}${rounded} m`;
  }

  private formatKmh(value: number | null): string {
    if (!this.hasNumber(value)) {
      return '—';
    }

    return `${this.formatDecimal(value, 1)} km/h`;
  }

  private formatMs(value: number | null): string {
    if (!this.hasNumber(value)) {
      return '—';
    }

    return `${this.formatDecimal(value, 1)} m/s`;
  }

  private formatKm(valueM: number | null): string {
    if (!this.hasNumber(valueM)) {
      return '—';
    }

    return `${this.formatDecimal(valueM / 1000, 1)} km`;
  }

  private formatNumber(value: number | null): string {
    if (!this.hasNumber(value)) {
      return '—';
    }

    return Math.round(value).toString();
  }

  private formatDecimal(value: number, digits: number): string {
    return value.toFixed(digits);
  }

  private hasNumber(value: number | null): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
}