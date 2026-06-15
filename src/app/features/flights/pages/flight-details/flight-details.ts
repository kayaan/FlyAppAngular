import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightMap } from '../../components/flight-map/flight-map';
import {
  FlightChartPoint,
  FlightLineChart,
} from '../../components/flight-line-chart/flight-line-chart';
import { FlightSummaryTags } from '../../components/flight-summary-tags/flight-summary-tags';
import { FlightSettingsStore } from '../../store/flight-settings.store';
import { TrackArrays } from '../../models/track-arrays.model';
import { debounceTime, Subject, takeUntil } from 'rxjs';
import { FlightClimbsPanel } from '../../components/flight-climbs-panel/flight-climbs-panel';

import { Flight3d } from '../../components/flight-3d/flight-3d';
import { FlightReplayControls } from '../../components/flight-replay-controls/flight-replay-controls';

const RESOLUTION_INPUT_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-flight-details',
  standalone: true,
  imports: [CommonModule, RouterLink, FlightLineChart, FlightMap, FlightSummaryTags, FlightClimbsPanel, Flight3d, FlightReplayControls],
  templateUrl: './flight-details.html',
  styleUrl: './flight-details.scss',
  providers: [FlightDetailsStore],
})
export class FlightDetails implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);

  readonly store = inject(FlightDetailsStore);
  readonly settingsStore = inject(FlightSettingsStore);

  readonly settingsDrawerOpen = signal(false);

  private readonly destroy$ = new Subject<void>();

  private readonly altitudeResolutionInput$: Subject<number> = new Subject<number>();
  private readonly varioResolutionInput$: Subject<number> = new Subject<number>();
  private readonly speedResolutionInput$: Subject<number> = new Subject<number>();


  viewMode: 'map' | '3d' = 'map';

  setViewMode(mode: 'map' | '3d'): void {
    this.viewMode = mode;
  }

  constructor() {
    this.altitudeResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setAltitudeChartResolutionInSec(value);
        this.store.recalculateTrackMetrics();
      });

    this.varioResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setVarioChartResolutionInSec(value);
        this.store.recalculateTrackMetrics();
      });

    this.speedResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setSpeedChartResolutionInSec(value);
        this.store.recalculateTrackMetrics();
      });
  }

  readonly flightStats = computed(() =>
    this.store.stats().find((item) => item.scopeType === 'flight') ?? null
  );

  readonly trackPointCount = computed(() => this.store.track()?.timeSec.length ?? 0);

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const flightId = Number(idParam);

    if (!Number.isFinite(flightId) || flightId <= 0) {
      return;
    }

    void this.store.loadFlight(flightId);
  }

  openSettingsDrawer(): void {
    this.settingsDrawerOpen.set(true);
  }

  closeSettingsDrawer(): void {
    this.settingsDrawerOpen.set(false);
  }

  setAltitudeChartVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.settingsStore.setShowAltitudeChart(checked);
  }

  setVarioChartVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.settingsStore.setShowVarioChart(checked);
  }

  setSpeedChartVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.settingsStore.setShowSpeedChart(checked);
  }

  setAltitudeResolution(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.altitudeResolutionInput$.next(value);
  }

  setVarioResolution(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.varioResolutionInput$.next(value);
  }

  setSpeedResolution(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.speedResolutionInput$.next(value);
  }

  readonly altitudeData = computed<FlightChartPoint[]>(() => {
    const track = this.store.track();
    const metrics = this.store.trackMetrics();

    if (!track || !metrics) {
      return [];
    }

    return this.toChartPoints(track.timeSec, metrics.altitudeM);
  });

  readonly varioData = computed<FlightChartPoint[]>(() => {
    const track = this.store.track();
    const metrics = this.store.trackMetrics();

    if (!track || !metrics) {
      return [];
    }

    return this.toChartPoints(track.timeSec, metrics.varioMs);
  });

  readonly speedData = computed<FlightChartPoint[]>(() => {
    const track = this.store.track();
    const metrics = this.store.trackMetrics();

    if (!track || !metrics) {
      return [];
    }

    return this.toChartPoints(track.timeSec, metrics.speedKmh);
  });

  private toChartPoints(
    timeSec: Int32Array,
    values: Float32Array
  ): FlightChartPoint[] {
    const pointCount = Math.min(timeSec.length, values.length);
    const result: FlightChartPoint[] = [];

    for (let i = 0; i < pointCount; i++) {
      result.push({
        index: i,
        timeSec: timeSec[i],
        value: values[i],
      });
    }

    return result;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  formatDate(value: string | undefined | null): string {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  formatDuration(durationSec: number | undefined | null): string {
    if (durationSec == null) return '—';

    const hours = Math.floor(durationSec / 3600);
    const minutes = Math.floor((durationSec % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  formatDistance(distanceM: number | undefined | null): string {
    if (distanceM == null) return '—';

    return `${(distanceM / 1000).toFixed(1)} km`;
  }

  formatHeight(heightM: number | undefined | null): string {
    if (heightM == null) return '—';

    return `${Math.round(heightM)} m`;
  }

  formatSpeed(speedKmh: number | undefined | null): string {
    if (speedKmh == null) return '—';

    return `${Math.round(speedKmh)} km/h`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.store.clear();
  }
}
